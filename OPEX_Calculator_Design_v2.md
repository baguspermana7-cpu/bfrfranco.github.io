# Data Center OPEX Calculator - Detailed Design v2.0
## Super Accurate Indonesia-Based Calculations

---

# PART 1: INDONESIA BASELINE (PRIMARY REFERENCE)

## 1.1 Indonesian Labor Market Analysis

### Minimum Wage Reference (UMK 2024-2025)

| Region | UMK/Month (IDR) | USD Equiv. | DC Location |
|--------|-----------------|------------|-------------|
| DKI Jakarta | Rp 5,067,381 | $320 | Primary Hub |
| Kab. Bekasi | Rp 5,343,430 | $338 | Industrial DC Zone |
| Kota Bekasi | Rp 5,261,847 | $332 | Industrial DC Zone |
| Kab. Karawang | Rp 5,376,085 | $340 | Industrial Zone |
| Kab. Bogor | Rp 4,813,988 | $304 | Emerging DC |
| Surabaya | Rp 4,725,479 | $299 | East Java Hub |
| Batam | Rp 4,586,661 | $290 | FTZ Zone |
| Bandung | Rp 4,048,462 | $256 | West Java |
| Semarang | Rp 3,243,969 | $205 | Central Java |
| Bali | Rp 3,027,000 | $191 | Tourism DC |

**Exchange Rate Used:** 1 USD = Rp 15,850 (floating reference)

---

## 1.2 Data Center Staffing Structure - Indonesia

### Role Hierarchy & Salary Bands (Monthly, Gross)

#### TIER 1: MANAGEMENT

| Role | Grade | Monthly Gross (IDR) | Annual (IDR) | Annual (USD) | Notes |
|------|-------|---------------------|--------------|--------------|-------|
| **Data Center Director** | M4 | 80,000,000 - 150,000,000 | 1,040,000,000 - 1,950,000,000 | $65,600 - $123,000 | Multi-site responsibility |
| **Facility Manager** | M3 | 45,000,000 - 80,000,000 | 585,000,000 - 1,040,000,000 | $36,900 - $65,600 | Single site head |
| **Operations Manager** | M2 | 30,000,000 - 50,000,000 | 390,000,000 - 650,000,000 | $24,600 - $41,000 | Shift operations head |
| **Maintenance Manager** | M2 | 28,000,000 - 45,000,000 | 364,000,000 - 585,000,000 | $23,000 - $36,900 | All maintenance |
| **EHS Manager** | M2 | 25,000,000 - 40,000,000 | 325,000,000 - 520,000,000 | $20,500 - $32,800 | Safety & compliance |

#### TIER 2: SUPERVISORY / SPECIALIST

| Role | Grade | Monthly Gross (IDR) | Annual (IDR) | Annual (USD) | Certification |
|------|-------|---------------------|--------------|--------------|---------------|
| **Shift Lead / Chief Engineer** | S3 | 18,000,000 - 28,000,000 | 234,000,000 - 364,000,000 | $14,800 - $23,000 | Ahli K3 Listrik preferred |
| **Ahli K3 Listrik (Certified)** | S3 | 20,000,000 - 35,000,000 | 260,000,000 - 455,000,000 | $16,400 - $28,700 | KEMNAKER certified |
| **Senior Electrical Engineer** | S2 | 15,000,000 - 25,000,000 | 195,000,000 - 325,000,000 | $12,300 - $20,500 | BNSP L6 |
| **Senior Mechanical Engineer** | S2 | 14,000,000 - 22,000,000 | 182,000,000 - 286,000,000 | $11,500 - $18,000 | |
| **DCIM/BMS Specialist** | S2 | 15,000,000 - 25,000,000 | 195,000,000 - 325,000,000 | $12,300 - $20,500 | Vendor certified |
| **Security Supervisor** | S1 | 8,000,000 - 12,000,000 | 104,000,000 - 156,000,000 | $6,600 - $9,800 | Gada Pratama/Madya |

#### TIER 3: TECHNICIAN LEVEL

| Role | Grade | Monthly Gross (IDR) | Annual (IDR) | Annual (USD) | Certification |
|------|-------|---------------------|--------------|--------------|---------------|
| **Electrical Technician (HV)** | T3 | 8,000,000 - 14,000,000 | 104,000,000 - 182,000,000 | $6,600 - $11,500 | BNSP L4-L5 |
| **Electrical Technician (LV)** | T2 | 6,500,000 - 10,000,000 | 84,500,000 - 130,000,000 | $5,300 - $8,200 | BNSP L3-L4 |
| **HVAC Technician** | T3 | 7,000,000 - 12,000,000 | 91,000,000 - 156,000,000 | $5,700 - $9,800 | Chiller certified |
| **Mechanical Technician** | T2 | 6,000,000 - 9,000,000 | 78,000,000 - 117,000,000 | $4,900 - $7,400 | |
| **Generator Technician** | T2 | 6,500,000 - 10,000,000 | 84,500,000 - 130,000,000 | $5,300 - $8,200 | Genset certified |
| **Fire System Technician** | T2 | 6,000,000 - 9,000,000 | 78,000,000 - 117,000,000 | $4,900 - $7,400 | Damkar certified |
| **BMS Operator** | T2 | 6,000,000 - 10,000,000 | 78,000,000 - 130,000,000 | $4,900 - $8,200 | |
| **Control Room Operator** | T1 | 5,500,000 - 8,000,000 | 71,500,000 - 104,000,000 | $4,500 - $6,600 | |

#### TIER 4: SUPPORT STAFF

| Role | Grade | Monthly Gross (IDR) | Annual (IDR) | Annual (USD) | Notes |
|------|-------|---------------------|--------------|--------------|-------|
| **Security Guard (Armed)** | U2 | 5,500,000 - 7,500,000 | 71,500,000 - 97,500,000 | $4,500 - $6,150 | Licensed |
| **Security Guard (Unarmed)** | U1 | 4,800,000 - 6,500,000 | 62,400,000 - 84,500,000 | $3,900 - $5,300 | Basic |
| **Cleaning Staff** | U1 | 4,500,000 - 5,500,000 | 58,500,000 - 71,500,000 | $3,700 - $4,500 | |
| **Driver** | U1 | 5,000,000 - 6,500,000 | 65,000,000 - 84,500,000 | $4,100 - $5,300 | |
| **Admin/Receptionist** | U2 | 5,000,000 - 7,000,000 | 65,000,000 - 91,000,000 | $4,100 - $5,700 | |

---

## 1.3 Employment Cost Breakdown - Indonesia

### In-House Employee Total Cost

| Component | % of Gross Salary | Mandatory | Notes |
|-----------|-------------------|-----------|-------|
| **Gross Salary** | 100% | Yes | Base calculation |
| **THR (Tunjangan Hari Raya)** | 8.33% (1/12) | Yes | Religious holiday bonus |
| **BPJS Kesehatan (Health)** | 4% (employer) | Yes | Capped at Rp 12M salary |
| **BPJS Ketenagakerjaan** | | | |
| - JKK (Accident) | 0.24% - 1.74% | Yes | DC = 0.89% (medium risk) |
| - JKM (Death) | 0.30% | Yes | Fixed |
| - JHT (Retirement Savings) | 3.70% | Yes | Employer portion |
| - JP (Pension) | 2.00% | Yes | Capped at Rp 9.5M |
| **Overtime Allowance** | 10-15% | Variable | Shift workers |
| **Meal Allowance** | 5-8% | Common | Rp 30-50k/day |
| **Transport Allowance** | 3-5% | Common | Or shuttle provided |
| **Certification Allowance** | 5-10% | Variable | K3, BNSP holders |
| **Shift Allowance** | 10-15% | Yes (shift) | Night shift premium |

### Total Employer Cost Multiplier

```
Base Calculation:
Gross Salary                    = 100.00%
+ THR                           =   8.33%
+ BPJS Kesehatan               =   4.00%
+ BPJS JKK                     =   0.89%
+ BPJS JKM                     =   0.30%
+ BPJS JHT                     =   3.70%
+ BPJS JP                      =   2.00%
─────────────────────────────────────────
Mandatory Overhead             =  19.22%

+ Allowances (avg)             =  15-25%
+ Training/Development         =   2-3%
+ Uniforms/PPE                 =   1-2%
+ Insurance (additional)       =   1-2%
─────────────────────────────────────────
TOTAL MULTIPLIER (In-House)   =  1.38 - 1.50x

RECOMMENDED FACTOR: 1.42x of Gross Salary
```

### Contractor Cost Structure

| Component | Typical Markup | Notes |
|-----------|----------------|-------|
| Base Salary (to worker) | 100% | Usually UMK + skill premium |
| Contractor Margin | 15-25% | Profit + overhead |
| Management Fee | 5-10% | Administration |
| Mobilization | 2-3% | Recruitment, training |
| **Total Markup** | **25-40%** | Over direct labor |

```
Contractor Rate = Worker_Salary × 1.30 to 1.45

But contractor worker salary is often LOWER than in-house equivalent
Net result: Contractor cost ≈ 0.85 - 1.10x of In-House cost

HOWEVER: Quality, loyalty, and expertise often lower
Hidden costs: Higher turnover, retraining, supervision
```

---

## 1.4 Staffing Requirements by Facility Size

### 24/7 Shift Coverage Model

```
Standard Shift Pattern (Indonesia):
- 3 shifts × 8 hours OR 2 shifts × 12 hours
- 5-team rotation for 24/7 coverage with leave
- Minimum 4 teams, recommended 5 teams

FTE Calculation:
24 hours/day × 365 days = 8,760 hours/year
Standard work hours = 40 hours/week × 52 weeks = 2,080 hours/year
Coverage ratio = 8,760 / 2,080 = 4.21

With leave, training, sick days:
Effective ratio = 4.8 - 5.2 FTE per 24/7 position
```

### Staffing Matrix by IT Load

| IT Load | Management | Shift Ops | Electrical | Mechanical | Security | Support | Total FTE |
|---------|------------|-----------|------------|------------|----------|---------|-----------|
| 500 kW | 2 | 5 | 3 | 2 | 5 | 2 | **19** |
| 1 MW | 3 | 5 | 4 | 3 | 5 | 3 | **23** |
| 2 MW | 3 | 6 | 6 | 4 | 6 | 4 | **29** |
| 5 MW | 4 | 8 | 10 | 6 | 8 | 5 | **41** |
| 10 MW | 5 | 10 | 15 | 10 | 10 | 8 | **58** |
| 20 MW | 7 | 15 | 25 | 15 | 12 | 12 | **86** |
| 50 MW | 10 | 25 | 50 | 30 | 20 | 20 | **155** |

### Staffing Formula (Precise)

```javascript
// Management
FTE_Director = IT_Load_MW >= 10 ? 1 : 0;
FTE_FacilityMgr = 1;
FTE_OpsMgr = Math.ceil(IT_Load_MW / 5);
FTE_MaintMgr = IT_Load_MW >= 2 ? 1 : 0;
FTE_EHSMgr = IT_Load_MW >= 5 ? 1 : 0;

// Shift Operations (24/7)
FTE_ShiftLead = Math.ceil(IT_Load_MW / 3) * 5;  // 5 for 24/7 coverage
FTE_ControlRoom = Math.max(5, Math.ceil(IT_Load_MW / 2) * 5);

// Electrical
FTE_AhliK3 = Math.max(1, Math.ceil(IT_Load_MW / 5));  // Mandatory
FTE_ElecHV = Math.ceil(IT_Load_MW * 1.5);
FTE_ElecLV = Math.ceil(IT_Load_MW * 1.0);

// Mechanical
FTE_HVAC = Math.ceil(IT_Load_MW * 1.2);
FTE_Mechanical = Math.ceil(IT_Load_MW * 0.5);
FTE_Generator = Math.ceil(IT_Load_MW * 0.3);
FTE_FireSystem = Math.max(1, Math.ceil(IT_Load_MW / 5));

// Support
FTE_Security = Math.max(5, Math.ceil(IT_Load_MW * 0.5) * 5);
FTE_Cleaning = Math.max(2, Math.ceil(IT_Load_MW * 0.2));
FTE_Admin = Math.max(1, Math.ceil(IT_Load_MW / 10));
```

---

## 1.5 Energy Costs - Indonesia (PLN Rates 2024-2025)

### Industrial Electricity Tariffs

| Tariff Class | Connection | Rate (Rp/kWh) | USD/kWh | Notes |
|--------------|------------|---------------|---------|-------|
| I-3/TM | 200 kVA+ | 1,114.74 | $0.070 | Medium Voltage |
| I-4/TT | 30 MVA+ | 996.74 | $0.063 | High Voltage (Tegangan Tinggi) |
| B-2/TR | 450 VA - 5.5 kVA | 1,444.70 | $0.091 | Low Voltage Business |
| B-3/TR | >200 kVA | 1,114.74 | $0.070 | Medium Business |

### Data Center Typical Rates

```
Most DC in Indonesia: I-3/TM or I-4/TT tariff
Average effective rate: Rp 1,050 - 1,200/kWh ($0.066 - $0.076/kWh)

With demand charges and power factor penalties:
Effective rate: Rp 1,150 - 1,350/kWh ($0.073 - $0.085/kWh)

RECOMMENDED CALCULATION: $0.075/kWh (Rp 1,190/kWh)
```

### Regional Energy Cost Variations

| Region | Rate Modifier | Notes |
|--------|---------------|-------|
| Java-Bali | 1.00x | Grid stable, baseline |
| Sumatra | 1.05x | Some grid constraints |
| Kalimantan | 1.08x | Industrial areas OK |
| Sulawesi | 1.12x | Growing infrastructure |
| Papua/Remote | 1.25-1.50x | Diesel dependency |
| Batam (FTZ) | 0.95x | Special economic zone |

---

## 1.6 Maintenance Costs - Indonesia Context

### OEM Maintenance Contracts (Annual)

| Equipment | % of CAPEX | Typical Cost/Unit | Notes |
|-----------|------------|-------------------|-------|
| UPS (Tier 1 brand) | 4-6% | $15-25k per 500kVA | Eaton, Vertiv, Schneider |
| UPS (Tier 2 brand) | 3-5% | $8-15k per 500kVA | Socomec, Riello |
| Generator (>1MW) | 3-4% | $20-40k per unit | Caterpillar, Cummins |
| Generator (<1MW) | 4-5% | $10-20k per unit | |
| Chiller (centrifugal) | 3-4% | $25-50k per 500TR | Trane, Carrier, York |
| Chiller (screw) | 4-5% | $15-30k per 300TR | |
| CRAH/CRAC Units | 3-4% | $3-6k per unit | |
| PDU/Switchgear | 2-3% | $5-10k per panel | |
| Fire Suppression | 2-3% | $5-15k per zone | Annual inspection mandatory |
| BMS/DCIM | 8-12% | $15-30k per site | Software + support |

### In-House vs Outsourced Maintenance Cost Comparison

| Maintenance Type | Full Outsource | Hybrid | Full In-House |
|------------------|----------------|--------|---------------|
| Routine/Daily | 1.0x | 0.6x | 0.4x |
| Preventive (PM) | 1.0x | 0.7x | 0.5x |
| Corrective | 1.0x | 0.8x | 0.6x |
| Emergency | 1.0x | 0.9x | 0.7x |
| OEM Specialized | 1.0x | 1.0x | 1.0x |
| **Weighted Average** | **1.0x** | **0.75x** | **0.58x** |

```
Note: In-house requires:
- Higher upfront training investment
- Spare parts inventory (2-5% of equipment value)
- Specialized tools and test equipment
- Ongoing certification maintenance
```

---

## 1.7 Insurance & Compliance - Indonesia

### Mandatory Insurance

| Type | Premium (% of Asset) | Coverage | Provider Type |
|------|---------------------|----------|---------------|
| Property All Risk (PAR) | 0.15-0.25% | Fire, flood, earthquake | General insurance |
| Business Interruption | 0.10-0.20% | Revenue loss | Add-on to PAR |
| Machinery Breakdown | 0.08-0.15% | Equipment failure | Engineering insurance |
| Public Liability | 0.02-0.05% | Third-party claims | General insurance |
| Employer Liability | BPJS covered | Work accidents | BPJS TK |

### Compliance & Certification Costs

| Requirement | Frequency | Cost (IDR) | Cost (USD) | Notes |
|-------------|-----------|------------|------------|-------|
| SLO (Electrical Safety) | Every 5 years | 25-50 juta | $1,600-3,200 | Sertifikat Laik Operasi |
| K3 Listrik Audit | Annual | 15-30 juta | $950-1,900 | Kemnaker requirement |
| Fire Safety Cert | Annual | 10-20 juta | $630-1,260 | Damkar inspection |
| Building IMB/PBG | One-time | Variable | Variable | Construction permit |
| Environmental (AMDAL/UKL-UPL) | Annual monitoring | 20-50 juta | $1,260-3,150 | If required |
| ISO 27001 | Annual | 50-100 juta | $3,150-6,300 | If certified |
| ISO 14001 | Annual | 30-60 juta | $1,900-3,800 | Environmental |
| Uptime Tier Cert | One-time | $75-150k | $75,000-150,000 | Optional |
| SOC 2 Type II | Annual | 100-200 juta | $6,300-12,600 | If required |

---

## 1.8 Other Operating Costs - Indonesia

### Consumables & Supplies

| Category | Annual Cost/MW | Notes |
|----------|----------------|-------|
| Filters (HVAC) | $2,000-4,000 | Quarterly replacement |
| Filters (Electrical) | $1,000-2,000 | UPS, PDU filters |
| Lubricants | $1,500-3,000 | Generators, pumps |
| Batteries (small) | $500-1,000 | Control systems |
| Cleaning Supplies | $1,000-2,000 | Specialized DC cleaning |
| PPE & Safety | $2,000-4,000 | Per employee avg $200-400 |
| Office Supplies | $500-1,000 | |
| **Total Consumables** | **$8,500-17,000/MW** | |

### Utilities (Non-Electric)

| Utility | Calculation | Typical Cost |
|---------|-------------|--------------|
| Water (municipal) | $0.50-1.00 per m³ | $0.01-0.02/kWh IT |
| Water (treatment) | Add 50% | Water-cooled systems |
| Diesel Fuel | Testing + reserve | $3-8/kW/year |
| Internet/Telecom | Per Mbps + fixed | $2,000-10,000/month |
| Waste Disposal | Hazmat separate | $500-2,000/month |

### Training & Development

| Training Type | Cost/Person | Frequency | Notes |
|---------------|-------------|-----------|-------|
| Ahli K3 Listrik | Rp 8-15 juta | Once (certification) | Mandatory for leads |
| K3 Umum | Rp 3-5 juta | Once | Basic safety |
| BNSP Electrical | Rp 2-4 juta | Every 3 years | Competency cert |
| OEM Training | $1,000-5,000 | Per equipment | Specialized |
| Soft Skills | Rp 1-3 juta | Annual | Leadership, etc |
| Emergency Response | Rp 2-4 juta | Annual | Fire, first aid |
| **Budget Rule** | **2-3% of labor cost** | | |

---

# PART 2: COUNTRY MULTIPLIERS (RELATIVE TO INDONESIA)

## 2.1 ASEAN Countries

| Country | Labor Mult. | Energy ($/kWh) | Maint. Mult. | Insurance Mult. | Notes |
|---------|-------------|----------------|--------------|-----------------|-------|
| **Indonesia** | 1.00 | 0.075 | 1.00 | 1.00 | Baseline |
| **Malaysia** | 1.40 | 0.085 | 1.15 | 0.95 | Developed infrastructure |
| **Singapore** | 3.50 | 0.180 | 1.50 | 1.20 | Premium market |
| **Thailand** | 1.25 | 0.095 | 1.10 | 0.90 | Growing DC hub |
| **Vietnam** | 0.80 | 0.075 | 0.95 | 0.85 | Emerging market |
| **Philippines** | 0.95 | 0.120 | 1.05 | 1.10 | High energy cost |
| **Myanmar** | 0.55 | 0.065 | 0.80 | 0.75 | Limited infrastructure |
| **Cambodia** | 0.60 | 0.150 | 0.85 | 0.80 | USD economy |

## 2.2 Asia Pacific

| Country | Labor Mult. | Energy ($/kWh) | Maint. Mult. | Insurance Mult. | Notes |
|---------|-------------|----------------|--------------|-----------------|-------|
| **Japan** | 4.20 | 0.220 | 1.80 | 1.50 | Premium, quality focus |
| **South Korea** | 3.00 | 0.110 | 1.40 | 1.20 | Advanced infrastructure |
| **Taiwan** | 2.50 | 0.090 | 1.30 | 1.10 | Tech hub |
| **Hong Kong** | 3.80 | 0.150 | 1.60 | 1.40 | Limited space |
| **China (Tier 1)** | 2.20 | 0.085 | 1.20 | 1.00 | Beijing, Shanghai |
| **China (Tier 2)** | 1.50 | 0.070 | 1.00 | 0.90 | Secondary cities |
| **India** | 0.65 | 0.080 | 0.85 | 0.80 | Large talent pool |
| **Australia** | 4.50 | 0.200 | 1.70 | 1.60 | High labor cost |
| **New Zealand** | 3.80 | 0.150 | 1.50 | 1.40 | |

## 2.3 Middle East

| Country | Labor Mult. | Energy ($/kWh) | Maint. Mult. | Insurance Mult. | Notes |
|---------|-------------|----------------|--------------|-----------------|-------|
| **UAE (Dubai)** | 2.80 | 0.065 | 1.40 | 1.30 | Expat labor |
| **UAE (Abu Dhabi)** | 2.60 | 0.055 | 1.35 | 1.25 | Subsidized energy |
| **Saudi Arabia** | 2.40 | 0.048 | 1.30 | 1.20 | Vision 2030 growth |
| **Qatar** | 3.00 | 0.040 | 1.45 | 1.35 | Highest income |
| **Bahrain** | 2.30 | 0.060 | 1.25 | 1.15 | Financial hub |
| **Oman** | 2.10 | 0.058 | 1.20 | 1.10 | |
| **Kuwait** | 2.50 | 0.035 | 1.35 | 1.25 | Cheapest energy |

## 2.4 Europe

| Country | Labor Mult. | Energy ($/kWh) | Maint. Mult. | Insurance Mult. | Notes |
|---------|-------------|----------------|--------------|-----------------|-------|
| **UK (London)** | 4.50 | 0.280 | 1.80 | 1.70 | Premium market |
| **UK (Other)** | 3.80 | 0.250 | 1.60 | 1.50 | |
| **Germany** | 4.80 | 0.350 | 1.90 | 1.60 | Highest energy |
| **Netherlands** | 4.20 | 0.280 | 1.70 | 1.50 | DC hub (AMS) |
| **Ireland** | 4.00 | 0.220 | 1.65 | 1.45 | Tech DC hub |
| **France** | 4.00 | 0.180 | 1.60 | 1.40 | Nuclear baseload |
| **Spain** | 3.20 | 0.200 | 1.40 | 1.25 | Growing market |
| **Italy** | 3.40 | 0.250 | 1.50 | 1.35 | |
| **Sweden** | 4.00 | 0.080 | 1.55 | 1.40 | Cheap renewable |
| **Norway** | 4.50 | 0.070 | 1.65 | 1.50 | Cheapest EU energy |
| **Finland** | 3.80 | 0.090 | 1.50 | 1.35 | Cold climate DC |
| **Poland** | 2.00 | 0.150 | 1.10 | 1.00 | Emerging EU hub |
| **Switzerland** | 5.50 | 0.120 | 2.00 | 1.80 | Highest labor |

## 2.5 Americas

| Country | Labor Mult. | Energy ($/kWh) | Maint. Mult. | Insurance Mult. | Notes |
|---------|-------------|----------------|--------------|-----------------|-------|
| **USA (Virginia)** | 4.50 | 0.075 | 1.70 | 1.60 | Data center alley |
| **USA (Texas)** | 4.20 | 0.085 | 1.60 | 1.50 | Energy hub |
| **USA (California)** | 5.50 | 0.220 | 1.90 | 1.80 | High cost |
| **USA (Oregon/WA)** | 4.80 | 0.060 | 1.75 | 1.65 | Hydro power |
| **USA (Average)** | 4.50 | 0.120 | 1.70 | 1.60 | |
| **Canada (Toronto)** | 4.00 | 0.090 | 1.55 | 1.45 | |
| **Canada (Montreal)** | 3.80 | 0.055 | 1.50 | 1.40 | Cheap hydro |
| **Mexico** | 1.30 | 0.095 | 1.05 | 0.95 | Near-shore |
| **Brazil (São Paulo)** | 1.50 | 0.140 | 1.15 | 1.10 | Largest LATAM |
| **Chile** | 1.80 | 0.110 | 1.20 | 1.15 | Mining + DC |
| **Colombia** | 1.10 | 0.100 | 1.00 | 0.95 | Emerging |

## 2.6 Africa

| Country | Labor Mult. | Energy ($/kWh) | Maint. Mult. | Insurance Mult. | Notes |
|---------|-------------|----------------|--------------|-----------------|-------|
| **South Africa** | 1.20 | 0.080 | 1.05 | 1.10 | Load shedding risk |
| **Nigeria** | 0.70 | 0.150 | 0.90 | 1.20 | Diesel dependent |
| **Kenya** | 0.65 | 0.120 | 0.85 | 1.00 | East Africa hub |
| **Egypt** | 0.80 | 0.065 | 0.90 | 0.95 | Growing market |
| **Morocco** | 0.90 | 0.100 | 0.95 | 1.00 | |

---

# PART 3: CALCULATION FORMULAS

## 3.1 Master OPEX Formula

```javascript
const calculateOPEX = (params) => {
    const {
        country,
        itLoadKW,
        pue,
        tierLevel,
        facilityAge,
        staffingModel,      // 'inhouse' | 'contractor' | 'partial'
        inhousePercent,     // 0-100 for partial
        utilizationPercent, // 50-100%
    } = params;

    // Get country factors
    const cf = countryFactors[country];

    // 1. ENERGY COST
    const totalPowerKW = itLoadKW * pue;
    const annualHours = 8760;
    const utilizationFactor = utilizationPercent / 100;
    const energyCost = totalPowerKW * annualHours * utilizationFactor * cf.energyRate;

    // 2. STAFFING COST
    const staffingReq = calculateStaffingFTE(itLoadKW, tierLevel);
    const baseLaborCost = calculateBaseLaborCost(staffingReq, country);

    let staffingMultiplier;
    if (staffingModel === 'inhouse') {
        staffingMultiplier = 1.42;  // Benefits + overhead
    } else if (staffingModel === 'contractor') {
        staffingMultiplier = 1.35;  // Contractor markup
    } else {
        // Partial - weighted average
        const inhouseRatio = inhousePercent / 100;
        staffingMultiplier = (inhouseRatio * 1.42) + ((1 - inhouseRatio) * 1.35);
    }

    const staffingCost = baseLaborCost * staffingMultiplier * cf.laborMultiplier;

    // 3. MAINTENANCE COST
    const estimatedCAPEX = itLoadKW * 15000;  // Rough CAPEX estimate $/kW
    const baseMaintenanceRate = getMaintenanceRate(facilityAge);
    const maintenanceCost = estimatedCAPEX * baseMaintenanceRate * cf.maintenanceMultiplier;

    // Adjust for staffing model
    const maintenanceModelFactor = staffingModel === 'inhouse' ? 0.65 :
                                   staffingModel === 'contractor' ? 1.0 :
                                   0.65 + (0.35 * (1 - inhousePercent/100));
    const adjustedMaintenanceCost = maintenanceCost * maintenanceModelFactor;

    // 4. INSURANCE COST
    const assetValue = estimatedCAPEX;
    const insuranceRate = 0.004;  // 0.4% of asset value
    const insuranceCost = assetValue * insuranceRate * cf.insuranceMultiplier;

    // 5. UTILITIES (NON-ELECTRIC)
    const waterCost = itLoadKW * 15 * cf.laborMultiplier;  // $15/kW baseline
    const fuelCost = itLoadKW * 8;  // $8/kW for testing/reserve
    const telecomCost = 5000 * 12 * cf.laborMultiplier;  // $5000/month baseline
    const utilitiesCost = waterCost + fuelCost + telecomCost;

    // 6. COMPLIANCE & CERTIFICATION
    const complianceCost = getComplianceCost(country, itLoadKW);

    // 7. OTHER COSTS
    const consumablesCost = itLoadKW * 12;  // $12/kW
    const trainingCost = staffingCost * 0.025;  // 2.5% of labor
    const miscCost = staffingCost * 0.05;  // 5% contingency
    const otherCosts = consumablesCost + trainingCost + miscCost;

    // TOTAL OPEX
    const totalOPEX = energyCost + staffingCost + adjustedMaintenanceCost +
                      insuranceCost + utilitiesCost + complianceCost + otherCosts;

    return {
        total: totalOPEX,
        monthly: totalOPEX / 12,
        perKW: totalOPEX / itLoadKW,
        perKWh: totalOPEX / (itLoadKW * 8760 * utilizationFactor),
        breakdown: {
            energy: { value: energyCost, percent: energyCost/totalOPEX*100 },
            staffing: { value: staffingCost, percent: staffingCost/totalOPEX*100 },
            maintenance: { value: adjustedMaintenanceCost, percent: adjustedMaintenanceCost/totalOPEX*100 },
            insurance: { value: insuranceCost, percent: insuranceCost/totalOPEX*100 },
            utilities: { value: utilitiesCost, percent: utilitiesCost/totalOPEX*100 },
            compliance: { value: complianceCost, percent: complianceCost/totalOPEX*100 },
            other: { value: otherCosts, percent: otherCosts/totalOPEX*100 },
        },
        staffingDetail: calculateDetailedStaffing(staffingReq, staffingModel, inhousePercent, country),
    };
};
```

## 3.2 Staffing Detail Calculator

```javascript
const calculateDetailedStaffing = (staffingReq, model, inhousePercent, country) => {
    const cf = countryFactors[country];
    const salaryData = indonesiaSalaryData;

    const roles = [
        { id: 'facilityMgr', name: 'Facility Manager', baseSalary: 62500000, category: 'management' },
        { id: 'opsMgr', name: 'Operations Manager', baseSalary: 40000000, category: 'management' },
        { id: 'shiftLead', name: 'Shift Lead/Chief Engineer', baseSalary: 23000000, category: 'operations' },
        { id: 'ahliK3', name: 'Ahli K3 Listrik', baseSalary: 27500000, category: 'specialist' },
        { id: 'elecHV', name: 'Electrical Tech (HV)', baseSalary: 11000000, category: 'technician' },
        { id: 'elecLV', name: 'Electrical Tech (LV)', baseSalary: 8250000, category: 'technician' },
        { id: 'hvacTech', name: 'HVAC Technician', baseSalary: 9500000, category: 'technician' },
        { id: 'mechTech', name: 'Mechanical Technician', baseSalary: 7500000, category: 'technician' },
        { id: 'bmsOp', name: 'BMS/Control Room Operator', baseSalary: 8000000, category: 'operations' },
        { id: 'security', name: 'Security Guard', baseSalary: 6000000, category: 'support' },
        { id: 'cleaning', name: 'Cleaning Staff', baseSalary: 5000000, category: 'support' },
    ];

    return roles.map(role => {
        const fte = staffingReq[role.id] || 0;
        const annualSalary = role.baseSalary * 13 / 15850;  // Convert to USD (13 months with THR)
        const countryAdjustedSalary = annualSalary * cf.laborMultiplier;

        let inhouseFTE, contractorFTE, inhouseCost, contractorCost;

        if (model === 'inhouse') {
            inhouseFTE = fte;
            contractorFTE = 0;
            inhouseCost = inhouseFTE * countryAdjustedSalary * 1.42;
            contractorCost = 0;
        } else if (model === 'contractor') {
            inhouseFTE = 0;
            contractorFTE = fte;
            inhouseCost = 0;
            contractorCost = contractorFTE * countryAdjustedSalary * 1.35;
        } else {
            // Partial - by category
            const categoryInhousePercent = getPartialSplit(role.category, inhousePercent);
            inhouseFTE = Math.round(fte * categoryInhousePercent / 100);
            contractorFTE = fte - inhouseFTE;
            inhouseCost = inhouseFTE * countryAdjustedSalary * 1.42;
            contractorCost = contractorFTE * countryAdjustedSalary * 1.35;
        }

        return {
            ...role,
            fte,
            inhouseFTE,
            contractorFTE,
            inhouseCost,
            contractorCost,
            totalCost: inhouseCost + contractorCost,
        };
    });
};
```

---

# PART 4: UI/UX SPECIFICATIONS

## 4.1 Page Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Navigation Bar - Same as datacenter-solutions.html]               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐
│  │  HERO SECTION                                                   │
│  │  "Data Center OPEX Calculator"                                  │
│  │  Comprehensive operational cost analysis with country-specific  │
│  │  rates and flexible staffing models                             │
│  └─────────────────────────────────────────────────────────────────┘
│                                                                     │
│  ┌──────────────────────────┬──────────────────────────────────────┐
│  │  INPUT PANEL (Left)      │  RESULTS PANEL (Right)               │
│  │  Sticky on scroll        │  Updates in real-time                │
│  │                          │                                      │
│  │  [Country Selection]     │  ┌────────────────────────────────┐  │
│  │  Flag + Name dropdown    │  │  TOTAL ANNUAL OPEX             │  │
│  │                          │  │  $2,450,000                     │  │
│  │  [Facility Parameters]   │  │  $204K/month | $2,450/kW/year │  │
│  │  • IT Load (kW)          │  └────────────────────────────────┘  │
│  │  • PUE slider            │                                      │
│  │  • Tier Level            │  [PIE CHART - Cost Breakdown]        │
│  │  • Facility Age          │                                      │
│  │  • Utilization %         │  [BAR CHART - Comparison]            │
│  │                          │                                      │
│  │  [Staffing Model]        │  [STAFFING TABLE]                    │
│  │  ○ Full In-house         │  Role | FTE | In | Out | Cost       │
│  │  ○ Partial (slider %)    │  ───────────────────────────         │
│  │  ○ Full Contractor       │  FM   | 1   | 1  | 0   | $62K        │
│  │                          │  ...                                 │
│  │  [Advanced: Per-Role]    │                                      │
│  │  Toggle for granular     │  [DETAILED BREAKDOWN TABLE]          │
│  │  control per role        │                                      │
│  │                          │  [EXPORT BUTTONS]                    │
│  │  [Calculate Button]      │  [PDF] [Excel] [Print]               │
│  └──────────────────────────┴──────────────────────────────────────┘
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐
│  │  SCENARIO COMPARISON (Full Width)                               │
│  │  Side-by-side: Current | Full In-house | Full Contractor        │
│  └─────────────────────────────────────────────────────────────────┘
│                                                                     │
│  [Footer]                                                           │
└─────────────────────────────────────────────────────────────────────┘
```

## 4.2 Component Specifications

### Country Selector
- Searchable dropdown with country flags
- Grouped by region (ASEAN, APAC, etc.)
- Shows key rates on selection (labor mult., energy rate)

### Staffing Model Selector
```
┌─────────────────────────────────────────────────────────────────┐
│  Select Staffing Model                                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   🏢        │  │   🔄        │  │   🤝        │             │
│  │ FULL        │  │  PARTIAL    │  │ FULL        │             │
│  │ IN-HOUSE    │  │  (HYBRID)   │  │ CONTRACTOR  │             │
│  │             │  │             │  │             │             │
│  │ ○ Selected  │  │ ○           │  │ ○           │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  [If Partial Selected]                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  In-House ←───────●───────────→ Contractor              │   │
│  │  70%                              30%                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [▼ Advanced: Per-Role Assignment]                              │
└─────────────────────────────────────────────────────────────────┘
```

### Results Summary Card
```
┌─────────────────────────────────────────────────────────────────┐
│  ANNUAL OPEX SUMMARY                          🇮🇩 Indonesia     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  $2,450,000                                                     │
│  ═══════════                                                    │
│  Annual Total OPEX                                              │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ $204K    │  │ $2,450   │  │ $0.28    │  │ 45%      │       │
│  │ /month   │  │ /kW/year │  │ /kWh     │  │ Energy   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                 │
│  Staffing: 70% In-house | 30% Contractor                       │
│  Total FTE: 24 (17 In-house + 7 Contractor)                    │
└─────────────────────────────────────────────────────────────────┘
```

---

# PART 5: IMPLEMENTATION CHECKLIST

## Phase 1: Core Structure
- [ ] Create opex-calculator.html with base structure
- [ ] Copy styling from datacenter-solutions.html
- [ ] Implement navigation consistency
- [ ] Add SEO meta tags

## Phase 2: Input Section
- [ ] Country selector with 40+ countries
- [ ] Facility parameter inputs
- [ ] Staffing model radio buttons
- [ ] Partial percentage slider
- [ ] Advanced per-role toggle

## Phase 3: Calculation Engine
- [ ] Implement country factors database
- [ ] Staffing FTE calculator
- [ ] Salary database (Indonesia base)
- [ ] Cost calculation functions
- [ ] Real-time update on input change

## Phase 4: Results Display
- [ ] Summary cards
- [ ] Pie chart (Chart.js)
- [ ] Bar chart comparisons
- [ ] Staffing breakdown table
- [ ] Detailed cost table

## Phase 5: Advanced Features
- [ ] Scenario comparison
- [ ] PDF export
- [ ] Excel download
- [ ] Print styling

---

*Design Document v2.0 - Super Accurate Indonesia-Based*
*Ready for Implementation*
