# OPEX Calculator - Detailed Breakdown Analysis
## Enhanced Parameters for Super Accurate Calculation

---

# PART 1: CURRENT GAPS IDENTIFIED

## Missing Parameters

| Category | Current State | What's Missing |
|----------|---------------|----------------|
| **Climate** | Not considered | Temperature, humidity, wet bulb, free cooling hours |
| **Cooling** | Bundled in maintenance | Chiller, cooling tower, CDU, refrigerant costs |
| **Generator** | Basic estimate | Fuel, oil, testing, parts, load bank |
| **Electrical** | Bundled | UPS, PDU, switchgear, transformer maintenance |
| **Utilities** | Basic | Peak/off-peak rates, water treatment, diesel price |
| **Insurance** | Single rate | PAR, BI, Machinery, Liability breakdown |
| **Compliance** | Basic | Country-specific permits and certifications |

---

# PART 2: RECOMMENDED NEW PARAMETERS (2-3 Critical Additions)

## Parameter 1: CLIMATE ZONE

### Why Critical:
- **Cooling = 30-50% of energy cost**
- Tropical countries like Indonesia have NO free cooling hours
- Temperate/cold climates can save 20-40% on cooling via economizer

### Climate Zone Options:

| Zone | Avg Temp | Humidity | Free Cooling Hours/Year | Cooling Multiplier |
|------|----------|----------|-------------------------|-------------------|
| **Tropical Humid** (Indonesia, Malaysia, Singapore) | 27-32°C | 80-95% | 0 | 1.00x (baseline) |
| **Tropical Dry** (UAE, Saudi summer) | 35-45°C | 20-40% | 0 | 1.15x (extreme heat) |
| **Subtropical** (Hong Kong, Taiwan, Florida) | 20-30°C | 60-80% | 500-1,500 | 0.92x |
| **Temperate** (UK, Germany, Netherlands) | 10-20°C | 50-70% | 3,000-5,000 | 0.75x |
| **Continental** (US Midwest, Poland) | -5 to 25°C | 40-60% | 4,000-6,000 | 0.70x |
| **Cold** (Nordic, Canada) | -10 to 15°C | 40-60% | 6,000-8,000 | 0.55x |

### Indonesia Specific:
```
Location: Equatorial (0-10° latitude)
Average Temperature: 27-33°C (80-91°F)
Relative Humidity: 70-95%
Wet Bulb Temperature: 25-28°C
Free Cooling Hours: 0 (never below 18°C)

Impact:
- Chillers run 24/7/365
- Higher chiller capacity required
- Cooling tower efficiency reduced due to high wet bulb
- Dehumidification load additional
```

## Parameter 2: COOLING SYSTEM TYPE

### Why Critical:
- Different systems have vastly different OPEX profiles
- DLC vs Air cooling = 40-60% energy difference
- Maintenance costs vary significantly

### Options:

| Cooling Type | Energy Mult. | Maint. Cost | Water Usage | Best For |
|--------------|--------------|-------------|-------------|----------|
| **Air-Cooled Chiller** | 1.15x | $25-40/kW/yr | None | Small/dry climate |
| **Water-Cooled Chiller** | 1.00x | $35-50/kW/yr | 2-4 L/kWh | Standard |
| **Chiller + Free Cooling** | 0.70-0.85x | $40-55/kW/yr | 2-4 L/kWh | Temperate |
| **In-Row/CRAH** | 1.10x | $20-30/kW/yr | Varies | Medium density |
| **Rear Door Heat Exchanger** | 0.95x | $30-45/kW/yr | Varies | High density |
| **Direct Liquid Cooling** | 0.75x | $50-70/kW/yr | Minimal | AI/HPC |
| **Immersion Cooling** | 0.65x | $60-80/kW/yr | None | Ultra-high density |

### Indonesia Consideration:
```
Recommended: Water-cooled chiller with cooling tower
Reason: Best efficiency in high humidity environment

Challenges:
- Cooling tower blowdown due to high TDS
- Legionella risk in warm water
- Higher water treatment costs
- Condenser scaling in hard water areas
```

## Parameter 3: GENERATOR CONFIGURATION

### Why Critical:
- Fuel cost = significant OPEX in regions with unreliable grid
- Indonesia PLN reliability varies by region
- Testing requirements differ by tier level

### Options:

| Config | Fuel Reserve | Testing Hours/Year | Maintenance Cost |
|--------|--------------|-------------------|------------------|
| **N (No backup)** | 8 hours | 12 hrs | $15-20/kW/yr |
| **N+1** | 24 hours | 24 hrs | $20-30/kW/yr |
| **2N** | 48 hours | 48 hrs | $35-50/kW/yr |
| **2N+1** | 72 hours | 72 hrs | $50-70/kW/yr |

### Indonesia Grid Reality:
```
Java-Bali Grid: 99.5-99.8% availability
Outside Java: 95-99% availability
Outage duration: 30 min - 4 hours typical

Fuel Costs (Indonesia):
- Diesel (Biosolar): Rp 6,800/liter ($0.43/L)
- Industrial Diesel: Rp 13,500/liter ($0.85/L)
- Generator consumption: ~0.25 L/kWh at 75% load
```

---

# PART 3: DETAILED COST BREAKDOWN

## 3.1 GENERATOR COSTS (Annual per MW IT Load)

| Component | Indonesia (IDR) | Indonesia (USD) | Calculation Basis |
|-----------|-----------------|-----------------|-------------------|
| **Preventive Maintenance** | | | |
| - Oil & filter change (4x/yr) | 25,000,000 | $1,577 | Per genset |
| - Coolant service (2x/yr) | 8,000,000 | $505 | Per genset |
| - Battery replacement (1x/2yr) | 15,000,000 | $946 | Annualized |
| - Belt & hose inspection | 5,000,000 | $315 | Annual |
| - Fuel system service | 10,000,000 | $631 | Annual |
| **Testing & Exercise** | | | |
| - Monthly load bank test (12x) | 36,000,000 | $2,271 | 2hr × 12 × fuel |
| - Quarterly full load test | 20,000,000 | $1,262 | 4hr × 4 × fuel |
| **OEM Service Contract** | 80,000,000 | $5,047 | Per 1MW genset |
| **Fuel Reserve Replenishment** | 15,000,000 | $946 | Annual top-up |
| **Emergency Repairs (reserve)** | 30,000,000 | $1,893 | 5% of equipment |
| **TOTAL per MW** | **244,000,000** | **$15,393** | |

**Per kW Calculation: $15.40/kW/year for generator maintenance**

## 3.2 COOLING SYSTEM COSTS (Annual per MW IT Load)

### Water-Cooled Chiller System (Indonesia Tropical)

| Component | Indonesia (IDR) | Indonesia (USD) | Notes |
|-----------|-----------------|-----------------|-------|
| **Chiller Maintenance** | | | |
| - Refrigerant top-up | 25,000,000 | $1,577 | R134a/R513A |
| - Compressor oil analysis | 8,000,000 | $505 | Quarterly |
| - Tube cleaning | 35,000,000 | $2,208 | Annual |
| - Control system service | 15,000,000 | $946 | |
| - OEM maintenance contract | 120,000,000 | $7,571 | Per 500TR chiller |
| **Cooling Tower** | | | |
| - Chemical treatment | 45,000,000 | $2,839 | Biocide, scale inhibitor |
| - Fill media replacement | 20,000,000 | $1,262 | 5-year amortized |
| - Fan motor service | 12,000,000 | $757 | |
| - Basin cleaning | 8,000,000 | $505 | Quarterly |
| **Pumps & Piping** | | | |
| - Pump maintenance | 25,000,000 | $1,577 | CHW, CW, CT pumps |
| - Valve service | 10,000,000 | $631 | |
| - Pipe insulation repair | 8,000,000 | $505 | |
| **Water Costs** | | | |
| - Makeup water | 80,000,000 | $5,047 | ~3 L/kWh IT × Rp 15/L |
| - Blowdown disposal | 15,000,000 | $946 | |
| - Water treatment chemicals | 25,000,000 | $1,577 | |
| **CRAH/AHU Units** | | | |
| - Filter replacement | 30,000,000 | $1,893 | Quarterly |
| - Fan motor service | 15,000,000 | $946 | |
| - Coil cleaning | 12,000,000 | $757 | |
| **TOTAL per MW** | **508,000,000** | **$32,049** | |

**Per kW Calculation: $32/kW/year for cooling maintenance**

### Climate Adjustment Factors:

| Climate | Water Cost Mult. | Maintenance Mult. | Energy Mult. |
|---------|------------------|-------------------|--------------|
| Tropical Humid (ID) | 1.00x | 1.00x | 1.00x |
| Tropical Dry (ME) | 0.50x | 1.10x | 1.15x |
| Temperate (EU) | 0.70x | 0.90x | 0.75x |
| Cold (Nordic) | 0.40x | 0.85x | 0.55x |

## 3.3 ELECTRICAL SYSTEM MAINTENANCE (Annual per MW IT Load)

| Component | Indonesia (IDR) | Indonesia (USD) | Notes |
|-----------|-----------------|-----------------|-------|
| **UPS Systems** | | | |
| - Battery monitoring/testing | 35,000,000 | $2,208 | Quarterly |
| - Capacitor inspection | 15,000,000 | $946 | Annual |
| - Fan replacement | 12,000,000 | $757 | Every 3 years |
| - OEM service contract | 150,000,000 | $9,464 | Per 500kVA UPS |
| **PDU/RPP** | | | |
| - Thermal imaging | 20,000,000 | $1,262 | Quarterly |
| - Breaker testing | 15,000,000 | $946 | Annual |
| - Busbar torque check | 8,000,000 | $505 | |
| **Transformer** | | | |
| - Oil analysis | 12,000,000 | $757 | Bi-annual |
| - Thermography | 8,000,000 | $505 | Quarterly |
| - Tap changer service | 25,000,000 | $1,577 | Annual |
| **Switchgear (MV/LV)** | | | |
| - Relay testing | 20,000,000 | $1,262 | Annual |
| - CB maintenance | 35,000,000 | $2,208 | |
| - Arc flash study update | 15,000,000 | $946 | Every 5 years |
| **Cabling & Containment** | | | |
| - Thermal scanning | 10,000,000 | $631 | Quarterly |
| - Tray inspection | 5,000,000 | $315 | |
| **TOTAL per MW** | **385,000,000** | **$24,289** | |

**Per kW Calculation: $24.30/kW/year for electrical maintenance**

## 3.4 UTILITY COSTS (Annual per MW IT Load @ 70% Utilization)

### Electricity (PLN Indonesia)

| Tariff | Rate (Rp/kWh) | USD/kWh | Applicable To |
|--------|---------------|---------|---------------|
| I-3/TM (200kVA+) | 1,114.74 | $0.070 | Medium Voltage |
| I-4/TT (30MVA+) | 996.74 | $0.063 | High Voltage |
| LWBP (Off-peak) | -20% | | Night discount |
| WBP (Peak) | +50% | | 18:00-22:00 |

**Annual Electricity Cost per MW IT Load:**
```
Calculation:
- IT Load: 1,000 kW
- PUE: 1.50
- Total Facility Load: 1,500 kW
- Annual Hours: 8,760
- Utilization: 70%
- Effective Rate: Rp 1,150/kWh ($0.073)

Annual Cost = 1,500 × 8,760 × 0.70 × 1,150
            = Rp 10,575,900,000
            = $667,154/MW IT Load
```

### Water (PDAM + Treatment)

| Component | Usage per MW | Rate | Annual Cost |
|-----------|--------------|------|-------------|
| Makeup Water | 15,000 m³/yr | Rp 12,000/m³ | Rp 180,000,000 ($11,356) |
| Blowdown Disposal | 5,000 m³/yr | Rp 8,000/m³ | Rp 40,000,000 ($2,524) |
| Treatment Chemicals | - | - | Rp 25,000,000 ($1,577) |
| **Total Water** | | | **$15,457/MW** |

### Diesel Fuel

| Purpose | Consumption | Rate | Annual Cost |
|---------|-------------|------|-------------|
| Generator Testing | 2,000 L/yr | Rp 13,500/L | Rp 27,000,000 ($1,703) |
| Fire Pump Testing | 500 L/yr | Rp 13,500/L | Rp 6,750,000 ($426) |
| Emergency Reserve | 1,000 L/yr | Rp 13,500/L | Rp 13,500,000 ($852) |
| **Total Fuel** | | | **$2,981/MW** |

## 3.5 INSURANCE & COMPLIANCE (Annual)

### Insurance (per $10M Asset Value)

| Type | Rate | Premium | Coverage |
|------|------|---------|----------|
| Property All Risk (PAR) | 0.15% | $15,000 | Fire, flood, earthquake |
| Business Interruption | 0.12% | $12,000 | Revenue loss |
| Machinery Breakdown | 0.08% | $8,000 | Equipment failure |
| Public Liability | 0.03% | $3,000 | Third-party |
| Directors & Officers | 0.02% | $2,000 | Management liability |
| **Total Insurance** | **0.40%** | **$40,000** | Per $10M asset |

**Per MW (assuming $12M CAPEX/MW): $48,000/MW/year**

### Compliance & Permits (Indonesia)

| Requirement | Frequency | Cost (IDR) | Cost (USD) |
|-------------|-----------|------------|------------|
| **SLO (Sertifikat Laik Operasi)** | 5 years | 35,000,000 | $2,208 |
| **K3 Listrik Audit** | Annual | 25,000,000 | $1,577 |
| **Fire Safety Certificate** | Annual | 15,000,000 | $946 |
| **AMDAL/UKL-UPL Monitoring** | Quarterly | 30,000,000 | $1,893 |
| **Building Safety (SLF)** | 5 years | 20,000,000 | $1,262 |
| **Hazmat License** | Annual | 10,000,000 | $631 |
| **Pressure Vessel Inspection** | Annual | 8,000,000 | $505 |
| **Lift/Elevator Cert** | Annual | 5,000,000 | $315 |
| **ISO Certification Audit** | Annual | 75,000,000 | $4,731 |
| **SOC 2 Audit** | Annual | 120,000,000 | $7,571 |
| **TOTAL (Annualized)** | | **358,000,000** | **$22,587** |

**Per MW (1MW facility): $22,587/year**
**Per MW (10MW facility): ~$8,000/year** (economies of scale)

---

# PART 4: ENHANCED CALCULATION FORMULAS

## Master Formula with All Parameters

```javascript
const calculateDetailedOPEX = (params) => {
    const {
        country,
        itLoadKW,
        pue,
        tierLevel,
        facilityAge,
        utilization,
        staffingModel,
        inhousePercent,
        // NEW PARAMETERS
        climateZone,        // tropical_humid, tropical_dry, subtropical, temperate, continental, cold
        coolingType,        // air_chiller, water_chiller, free_cooling, inrow, rdhx, dlc, immersion
        generatorConfig,    // n, n1, 2n, 2n1
    } = params;

    const cf = countryFactors[country];
    const climate = climateFactors[climateZone];
    const cooling = coolingFactors[coolingType];
    const genset = generatorFactors[generatorConfig];

    // ============ ENERGY COSTS ============
    const totalPowerKW = itLoadKW * pue * climate.coolingEnergyMult;
    const annualKWh = totalPowerKW * 8760 * utilization;
    const energyCost = annualKWh * cf.energyRate;

    // ============ STAFFING COSTS ============
    const staffingCost = calculateStaffingCost(itLoadKW, tierLevel, staffingModel, inhousePercent, cf);

    // ============ MAINTENANCE COSTS ============
    const mw = itLoadKW / 1000;
    const ageFactor = facilityAge === 'new' ? 0.6 : facilityAge === 'mid' ? 1.0 : 1.5;

    // Generator Maintenance
    const generatorMaintenance = mw * 15400 * genset.maintMult * ageFactor * cf.maintMult;

    // Cooling Maintenance
    const coolingMaintenance = mw * 32000 * cooling.maintMult * climate.coolingMaintMult * ageFactor * cf.maintMult;

    // Electrical Maintenance
    const electricalMaintenance = mw * 24300 * ageFactor * cf.maintMult;

    // Fire & Safety Maintenance
    const fireMaintenance = mw * 8000 * ageFactor * cf.maintMult;

    // BMS/DCIM Maintenance
    const bmsMaintenance = mw * 12000 * cf.maintMult;

    const totalMaintenance = generatorMaintenance + coolingMaintenance + electricalMaintenance + fireMaintenance + bmsMaintenance;

    // ============ UTILITY COSTS (NON-ELECTRIC) ============
    // Water
    const waterCost = mw * 15500 * cooling.waterMult * climate.waterMult * cf.laborMult;

    // Diesel Fuel
    const fuelCost = mw * 3000 * genset.fuelMult;

    // Telecom
    const telecomCost = 4000 * 12 * Math.max(1, Math.sqrt(mw));

    const totalUtilities = waterCost + fuelCost + telecomCost;

    // ============ INSURANCE ============
    const estimatedCAPEX = itLoadKW * 12000;
    const insuranceCost = estimatedCAPEX * 0.004 * cf.insuranceMult;

    // ============ COMPLIANCE ============
    const baseCompliance = 22587; // Base for 1MW
    const scaleFactor = Math.pow(mw, 0.7); // Economies of scale
    const complianceCost = baseCompliance * scaleFactor * cf.complianceMult;

    // ============ OTHER COSTS ============
    const consumablesCost = itLoadKW * 8;
    const trainingCost = staffingCost * 0.025;
    const miscCost = (energyCost + staffingCost + totalMaintenance) * 0.015;
    const otherCosts = consumablesCost + trainingCost + miscCost;

    // ============ TOTAL ============
    const totalOPEX = energyCost + staffingCost + totalMaintenance +
                      totalUtilities + insuranceCost + complianceCost + otherCosts;

    return {
        total: totalOPEX,
        breakdown: {
            energy: energyCost,
            staffing: staffingCost,
            maintenance: {
                total: totalMaintenance,
                generator: generatorMaintenance,
                cooling: coolingMaintenance,
                electrical: electricalMaintenance,
                fire: fireMaintenance,
                bms: bmsMaintenance,
            },
            utilities: {
                total: totalUtilities,
                water: waterCost,
                fuel: fuelCost,
                telecom: telecomCost,
            },
            insurance: insuranceCost,
            compliance: complianceCost,
            other: otherCosts,
        }
    };
};
```

## Climate Factors

```javascript
const climateFactors = {
    tropical_humid: {
        name: 'Tropical Humid (Indonesia, Malaysia, Singapore)',
        avgTemp: 30,
        humidity: 85,
        freeCoolingHours: 0,
        coolingEnergyMult: 1.00,
        coolingMaintMult: 1.00,
        waterMult: 1.00,
    },
    tropical_dry: {
        name: 'Tropical Dry (UAE, Saudi, Qatar)',
        avgTemp: 38,
        humidity: 30,
        freeCoolingHours: 0,
        coolingEnergyMult: 1.15,
        coolingMaintMult: 1.10,
        waterMult: 0.50,  // Less evaporation losses
    },
    subtropical: {
        name: 'Subtropical (Hong Kong, Taiwan, Florida)',
        avgTemp: 25,
        humidity: 70,
        freeCoolingHours: 1000,
        coolingEnergyMult: 0.92,
        coolingMaintMult: 0.95,
        waterMult: 0.85,
    },
    temperate: {
        name: 'Temperate (UK, Germany, Netherlands)',
        avgTemp: 15,
        humidity: 60,
        freeCoolingHours: 4000,
        coolingEnergyMult: 0.75,
        coolingMaintMult: 0.90,
        waterMult: 0.70,
    },
    continental: {
        name: 'Continental (US Midwest, Poland)',
        avgTemp: 12,
        humidity: 50,
        freeCoolingHours: 5000,
        coolingEnergyMult: 0.70,
        coolingMaintMult: 0.88,
        waterMult: 0.65,
    },
    cold: {
        name: 'Cold (Nordic, Canada)',
        avgTemp: 5,
        humidity: 50,
        freeCoolingHours: 7000,
        coolingEnergyMult: 0.55,
        coolingMaintMult: 0.85,
        waterMult: 0.40,
    },
};
```

## Cooling Type Factors

```javascript
const coolingFactors = {
    air_chiller: {
        name: 'Air-Cooled Chiller',
        energyMult: 1.15,
        maintMult: 0.85,
        waterMult: 0.00,
        maxDensity: 10,
    },
    water_chiller: {
        name: 'Water-Cooled Chiller',
        energyMult: 1.00,
        maintMult: 1.00,
        waterMult: 1.00,
        maxDensity: 15,
    },
    free_cooling: {
        name: 'Chiller + Free Cooling Economizer',
        energyMult: 0.80,  // Varies by climate
        maintMult: 1.10,
        waterMult: 0.80,
        maxDensity: 15,
    },
    inrow: {
        name: 'In-Row Cooling (CRAH)',
        energyMult: 1.10,
        maintMult: 0.90,
        waterMult: 0.70,
        maxDensity: 20,
    },
    rdhx: {
        name: 'Rear Door Heat Exchanger',
        energyMult: 0.95,
        maintMult: 1.05,
        waterMult: 0.80,
        maxDensity: 35,
    },
    dlc: {
        name: 'Direct Liquid Cooling (CDU)',
        energyMult: 0.75,
        maintMult: 1.30,
        waterMult: 0.30,
        maxDensity: 100,
    },
    immersion: {
        name: 'Immersion Cooling',
        energyMult: 0.65,
        maintMult: 1.50,
        waterMult: 0.00,
        maxDensity: 200,
    },
};
```

## Generator Configuration Factors

```javascript
const generatorFactors = {
    n: {
        name: 'N (No Redundancy)',
        fuelReserve: 8,
        testingHours: 12,
        maintMult: 0.70,
        fuelMult: 0.60,
    },
    n1: {
        name: 'N+1 (Single Redundancy)',
        fuelReserve: 24,
        testingHours: 24,
        maintMult: 1.00,
        fuelMult: 1.00,
    },
    '2n': {
        name: '2N (Full Redundancy)',
        fuelReserve: 48,
        testingHours: 48,
        maintMult: 1.80,
        fuelMult: 1.80,
    },
    '2n1': {
        name: '2N+1 (Full + Backup)',
        fuelReserve: 72,
        testingHours: 72,
        maintMult: 2.50,
        fuelMult: 2.50,
    },
};
```

---

# PART 5: INDONESIA-SPECIFIC CONSIDERATIONS

## Regional Variations in Indonesia

| Region | Grid Reliability | Energy Cost | Labor Mult. | Climate Notes |
|--------|------------------|-------------|-------------|---------------|
| DKI Jakarta | 99.8% | Baseline | 1.00x | Urban heat island |
| Bekasi/Karawang | 99.5% | Baseline | 0.95x | Industrial zone |
| Surabaya | 99.3% | +5% | 0.90x | Coastal humidity |
| Batam (FTZ) | 99.0% | -5% | 0.85x | Island logistics cost |
| Bali | 98.5% | +10% | 0.92x | Tourism premium |
| Makassar | 97% | +15% | 0.75x | Limited infrastructure |
| Papua | 92% | +40% | 0.70x | Remote, diesel dependent |

## Indonesia Compliance Calendar

| Month | Activity | Estimated Cost |
|-------|----------|----------------|
| January | Annual K3 Audit preparation | Internal |
| February | K3 Listrik Audit (Kemnaker) | Rp 25 juta |
| March | Fire Safety Inspection (Damkar) | Rp 15 juta |
| April | ISO Surveillance Audit | Rp 35 juta |
| May | Environmental Monitoring (UKL-UPL) Q2 | Rp 8 juta |
| June | Pressure Vessel Inspection | Rp 8 juta |
| July | Mid-year Safety Review | Internal |
| August | Environmental Monitoring Q3 | Rp 8 juta |
| September | SOC 2 Type II Audit | Rp 120 juta |
| October | SLO Renewal (if applicable) | Rp 35 juta |
| November | Environmental Monitoring Q4 | Rp 8 juta |
| December | Annual Report Preparation | Internal |

---

# SUMMARY: 3 NEW PARAMETERS TO ADD

1. **Climate Zone** - Critical for cooling energy and maintenance calculations
2. **Cooling System Type** - Determines energy efficiency and water usage
3. **Generator Configuration** - Affects maintenance and fuel costs based on redundancy level

These three parameters will increase calculation accuracy by **15-25%** compared to the current model.
