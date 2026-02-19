# Data Center OPEX Calculator - Design Document

## Overview
A comprehensive, super-accurate OPEX (Operational Expenditure) calculator for data center operations with country-specific pricing, staffing model flexibility, and detailed cost breakdowns.

---

## 1. INPUT SECTIONS

### Section A: Facility Parameters
| Input | Type | Options/Range | Purpose |
|-------|------|---------------|---------|
| **Country/Region** | Dropdown | 25+ countries with regional variants | Adjusts all labor & material costs |
| **IT Load (kW)** | Number | 100 - 100,000 kW | Primary scaling factor |
| **PUE (Power Usage Effectiveness)** | Slider | 1.2 - 2.0 | Calculates total facility power |
| **Tier Classification** | Radio | Tier I, II, III, IV | Affects staffing requirements |
| **Facility Age** | Dropdown | New (0-3yr), Mid (4-10yr), Mature (10+yr) | Impacts maintenance costs |

### Section B: Staffing Model Selection
| Input | Type | Options | Description |
|-------|------|---------|-------------|
| **Primary Staffing Model** | Radio | Full In-house / Partial / Full Contractor | Main selection |
| **Partial Split (if Partial)** | Slider | 10% - 90% In-house | Adjustable percentage |

#### Detailed Role Assignment (Advanced Mode)
For each role, user can specify In-house vs Contractor:

| Role Category | Roles Included | Typical FTE per 1MW |
|---------------|----------------|---------------------|
| **Management** | Facility Manager, Ops Manager | 0.5 - 1.0 |
| **Shift Engineers** | 24/7 Shift Leads, Control Room | 4.0 - 6.0 |
| **Electrical** | HV/LV Technicians, Ahli K3 Listrik | 2.0 - 4.0 |
| **Mechanical** | HVAC Technicians, Plumbers | 2.0 - 3.0 |
| **Security** | Physical Security, Access Control | 4.0 - 6.0 |
| **Cleaning/Support** | Janitorial, General Support | 1.0 - 2.0 |

---

## 2. COUNTRY DATABASE (Sample)

### Labor Cost Multipliers (Relative to Indonesia = 1.00)

| Country | Labor Mult. | Energy ($/kWh) | Remarks |
|---------|-------------|----------------|---------|
| **ASEAN** | | | |
| Indonesia | 1.00 | $0.08 | Baseline |
| Malaysia | 1.35 | $0.09 | |
| Singapore | 3.20 | $0.18 | High labor, high energy |
| Thailand | 1.15 | $0.10 | |
| Vietnam | 0.85 | $0.07 | |
| Philippines | 0.90 | $0.12 | Higher energy cost |
| **Asia Pacific** | | | |
| Japan | 3.80 | $0.22 | Premium market |
| South Korea | 2.80 | $0.11 | |
| Australia | 4.20 | $0.20 | |
| India | 0.70 | $0.08 | |
| Hong Kong | 3.50 | $0.15 | |
| **Middle East** | | | |
| UAE | 2.50 | $0.06 | Cheap energy |
| Saudi Arabia | 2.20 | $0.05 | Subsidized energy |
| Qatar | 2.60 | $0.04 | Cheapest energy |
| **Europe** | | | |
| UK | 4.00 | $0.25 | |
| Germany | 4.20 | $0.35 | Highest energy |
| Netherlands | 3.80 | $0.28 | Data center hub |
| Ireland | 3.50 | $0.22 | |
| Nordic (Sweden/Finland) | 3.60 | $0.08 | Cheap renewable |
| **Americas** | | | |
| USA (Average) | 4.50 | $0.12 | |
| USA (Virginia) | 4.20 | $0.08 | Data center alley |
| USA (California) | 5.00 | $0.22 | High costs |
| Brazil | 1.20 | $0.15 | |
| Mexico | 1.10 | $0.10 | |

---

## 3. OPEX COST CATEGORIES

### 3.1 Staffing Costs (35-45% of OPEX)

#### Base Salary by Role (Annual, Indonesia Baseline in USD)

| Role | In-house Salary | Contractor Rate | Notes |
|------|-----------------|-----------------|-------|
| Facility Manager | $24,000 | $32,000 | +33% contractor premium |
| Operations Manager | $18,000 | $24,000 | |
| Shift Lead | $12,000 | $16,000 | Need 5 for 24/7 |
| Sr. Electrical Tech (Ahli K3) | $10,000 | $14,000 | |
| Electrical Technician | $7,200 | $10,000 | |
| HVAC Technician | $7,200 | $10,000 | |
| Mechanical Tech | $6,000 | $8,500 | |
| Security (Shift) | $4,800 | $6,500 | Need 5 for 24/7 |
| Cleaning Staff | $3,600 | $5,000 | |

**Contractor Premium Factors:**
- Full In-house: 1.0x salary + 25% benefits overhead = 1.25x
- Full Contractor: 1.4x base rate (includes contractor margin)
- Partial: Weighted average based on split

#### Staffing Formulas by IT Load

```
Management FTE = ceil(IT_Load_MW * 0.5) + 1
Shift_Coverage = 5 (for 24/7 with leave coverage)
Electrical_FTE = ceil(IT_Load_MW * 2.5)
Mechanical_FTE = ceil(IT_Load_MW * 2.0)
Security_FTE = 5 (minimum for 24/7)
Support_FTE = ceil(IT_Load_MW * 1.0)
```

### 3.2 Energy Costs (40-55% of OPEX)

```
Annual_Energy_Cost = IT_Load_kW × PUE × 8,760 hours × Energy_Rate × Utilization_Factor

Where:
- Utilization_Factor = 0.70 (typical) to 0.95 (fully loaded)
```

| PUE | Energy Overhead | Typical Facility |
|-----|-----------------|------------------|
| 1.2 | 20% overhead | Best-in-class DLC |
| 1.4 | 40% overhead | Modern efficient |
| 1.6 | 60% overhead | Average |
| 1.8 | 80% overhead | Older facility |
| 2.0 | 100% overhead | Legacy inefficient |

### 3.3 Maintenance Costs (8-15% of OPEX)

| Category | % of CAPEX/year | In-house Factor | Contractor Factor |
|----------|-----------------|-----------------|-------------------|
| **Preventive Maintenance** | | | |
| Electrical Systems | 2.0% | 0.8x | 1.0x |
| UPS Systems | 3.5% | 1.0x | 1.0x (OEM required) |
| Generator Systems | 3.0% | 0.9x | 1.0x |
| Cooling Systems | 4.0% | 0.85x | 1.0x |
| Fire Suppression | 2.5% | 1.0x | 1.0x (certified req) |
| BMS/DCIM | 5.0% | 0.7x | 1.0x |
| **Corrective Maintenance** | | | |
| Emergency Repairs | 1.5% | 0.6x | 1.0x |
| Spare Parts | 0.8% | 1.0x | 1.2x |

**Age Factor:**
- New (0-3 years): 0.6x maintenance
- Mid (4-10 years): 1.0x maintenance
- Mature (10+ years): 1.5x maintenance

### 3.4 Utilities (Non-Electric)

| Utility | Calculation | Typical Range |
|---------|-------------|---------------|
| Water (Cooling) | $0.02-0.05/kWh IT load | Chiller dependent |
| Fuel (Backup) | Testing + emergency reserve | $5-15/kW/year |
| Telecom/Internet | Fixed + bandwidth | $2,000-10,000/month |

### 3.5 Insurance & Compliance (3-5% of OPEX)

| Category | % of Asset Value | Notes |
|----------|------------------|-------|
| Property Insurance | 0.15-0.25% | Based on replacement cost |
| Business Interruption | 0.10-0.20% | Based on revenue at risk |
| Equipment Breakdown | 0.05-0.10% | Critical systems |
| Liability Insurance | 0.05% | General + professional |
| Certification Audits | Fixed | Tier cert, ISO, SOC2 |
| Regulatory Compliance | Varies by country | Local safety requirements |

### 3.6 Other Operating Costs

| Category | Typical Annual Cost |
|----------|---------------------|
| Consumables | $5-10/kW |
| Waste Management | $2-5/kW |
| Office Supplies | $1,000-3,000/employee |
| Training & Development | 2-3% of labor cost |
| Travel & Transportation | $500-1,500/employee |
| Software Licenses | $10-20/kW |

---

## 4. OUTPUT DISPLAY

### 4.1 Summary Dashboard
```
┌─────────────────────────────────────────────────────────┐
│  ANNUAL OPEX SUMMARY                                    │
├─────────────────────────────────────────────────────────┤
│  Total Annual OPEX:          $2,450,000                 │
│  Monthly OPEX:               $204,167                   │
│  OPEX per kW IT Load:        $2,450/kW/year            │
│  OPEX per kWh:               $0.28/kWh                  │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Cost Breakdown (Pie Chart + Table)

| Category | Annual Cost | % of Total | $/kW/year |
|----------|-------------|------------|-----------|
| Energy | $980,000 | 40% | $980 |
| Staffing | $735,000 | 30% | $735 |
| Maintenance | $294,000 | 12% | $294 |
| Insurance | $147,000 | 6% | $147 |
| Utilities | $147,000 | 6% | $147 |
| Other | $147,000 | 6% | $147 |

### 4.3 Staffing Breakdown

| Role | FTE | In-house | Contractor | Annual Cost |
|------|-----|----------|------------|-------------|
| Facility Manager | 1 | 1 | 0 | $30,000 |
| Shift Engineers | 5 | 3 | 2 | $75,000 |
| Electrical Tech | 4 | 4 | 0 | $36,000 |
| ... | ... | ... | ... | ... |
| **Total** | **24** | **16** | **8** | **$735,000** |

### 4.4 Comparison Mode

Show side-by-side comparison:
- Full In-house vs Full Contractor vs Current Mix
- Different country scenarios
- Different PUE scenarios

---

## 5. ADVANCED FEATURES

### 5.1 Scenario Builder
- Save and compare up to 3 scenarios
- What-if analysis (change one variable)

### 5.2 Multi-Year Projection
- 5-year OPEX forecast
- Inflation adjustment by country
- Efficiency improvement roadmap

### 5.3 Benchmark Comparison
- Compare against industry averages
- Show percentile ranking (e.g., "Your OPEX is better than 65% of similar facilities")

### 5.4 Export Options
- PDF Report with charts
- Excel download with all calculations
- Print-friendly summary

---

## 6. UI/UX DESIGN

### Layout Structure
```
┌──────────────────────────────────────────────────────────────┐
│  [Navigation Bar]                                             │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐│
│  │                     │  │                                 ││
│  │  INPUT PANEL        │  │  RESULTS PANEL                  ││
│  │  (Left Side)        │  │  (Right Side)                   ││
│  │                     │  │                                 ││
│  │  • Country          │  │  • Summary Cards                ││
│  │  • Facility Params  │  │  • Interactive Charts           ││
│  │  • Staffing Model   │  │  • Detailed Breakdown           ││
│  │  • Advanced Options │  │  • Comparison Tables            ││
│  │                     │  │                                 ││
│  └─────────────────────┘  └─────────────────────────────────┘│
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Visual Style (Matching Existing)
- Glassmorphism cards
- Gradient accents (gold/amber for cost, emerald for savings)
- Smooth animations
- Interactive tooltips with detailed explanations
- Real-time calculation updates

---

## 7. FORMULA SUMMARY

### Total Annual OPEX
```javascript
Total_OPEX =
    Staffing_Cost +
    Energy_Cost +
    Maintenance_Cost +
    Insurance_Cost +
    Utilities_Cost +
    Other_Costs

Where:
    Staffing_Cost = Σ(Role_FTE × Salary × Country_Factor × Model_Factor)
    Energy_Cost = IT_Load × PUE × 8760 × Energy_Rate × Utilization
    Maintenance_Cost = CAPEX_Estimate × Maintenance_% × Age_Factor
    Insurance_Cost = Asset_Value × Insurance_Rate
    Utilities_Cost = Water + Fuel + Telecom
    Other_Costs = Consumables + Waste + Training + Licenses
```

### Staffing Model Factors
```javascript
if (model === 'full_inhouse') {
    factor = 1.25;  // Base + 25% benefits
} else if (model === 'full_contractor') {
    factor = 1.40;  // Contractor markup
} else {  // Partial
    factor = (inhouse_pct × 1.25) + (contractor_pct × 1.40);
}
```

---

## 8. IMPLEMENTATION PHASES

### Phase 1: Core Calculator
- Basic inputs (Country, IT Load, PUE, Tier)
- Staffing model selection (3 options)
- Simple percentage-based calculations
- Summary output

### Phase 2: Advanced Features
- Detailed role-by-role staffing
- Maintenance breakdown
- Age factors
- Comparison mode

### Phase 3: Analytics & Export
- Multi-year projections
- Benchmark comparisons
- PDF/Excel export
- Scenario saving

---

## Notes for Implementation

1. **Data Accuracy**: All country-specific rates should be validated against current market data
2. **Currency**: Calculate in USD, show local currency option
3. **Updates**: Build mechanism to update rates without code changes (JSON config)
4. **Validation**: Warn users when inputs seem unrealistic
5. **Mobile**: Ensure responsive design for tablet/mobile viewing

---

*Design Document v1.0 - Ready for Review*
