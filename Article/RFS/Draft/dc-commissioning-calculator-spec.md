# Data Center Commissioning & RFS Calculator — Complete Specification

## Document Purpose
This specification defines the complete design for an interactive Data Center Commissioning & Ready-for-Service (RFS) Calculator tool. It covers inputs, algorithms, data structures, cost models, Gantt chart logic, cloud company profiles, expandable UI hierarchy, testing protocols, and PDF export design. This document serves as the engineering blueprint for implementation.

## Design Philosophy
- **Playbook-grade accuracy**: Every cost, timeline, and staffing figure is benchmarked against real hyperscaler data (AWS, Google, Microsoft, Meta, Oracle, xAI, OpenAI/Stargate, NVIDIA, Apple, Equinix)
- **Expandable hierarchy**: Every section expands into subsystems, every subsystem into components, every component into individual tests — 4 levels deep
- **Cloud company presets**: Select a cloud provider profile and the calculator auto-configures RFS requirements, testing rigor, PUE targets, and sustainability mandates
- **Gantt chart with dependencies**: Interactive timeline showing L0→L6 phases with critical path, overlaps, and milestone markers
- **Cost model**: Bottom-up from individual test activities, equipment rental, personnel day-rates, rolled up to system → phase → total
- **Consistent with portfolio**: Adopts CAPEX calculator inputs, Free/Pro mode, PDF export via window.open() with inline SVG, same auth system

---

## Table of Contents

1. [Input Design](#1-input-design)
2. [Cloud Company RFS Profiles](#2-cloud-company-rfs-profiles)
3. [Commissioning Phase Data Structure (L0-L6)](#3-commissioning-phase-data-structure-l0-l6)
4. [Expandable Hierarchy — Full Tree](#4-expandable-hierarchy--full-tree)
5. [Cost Model & Algorithms](#5-cost-model--algorithms)
6. [Timeline / Gantt Chart Model](#6-timeline--gantt-chart-model)
7. [Staffing Model](#7-staffing-model)
8. [Testing Protocol Data](#8-testing-protocol-data)
9. [Output Panels & KPIs](#9-output-panels--kpis)
10. [Free vs Pro Feature Matrix](#10-free-vs-pro-feature-matrix)
11. [PDF Export Design](#11-pdf-export-design)
12. [UI/UX Design](#12-uiux-design)
13. [Data Sources & References](#13-data-sources--references)

---

## 1. Input Design

### 1.1 Input Section A: Facility Profile (Adopted from CAPEX Calculator)

| Input ID | Label | Type | Range | Default | Step | Unit | Notes |
|----------|-------|------|-------|---------|------|------|-------|
| `cxFacilityType` | Facility Type | select | Enterprise, Colocation, Hyperscale, AI/HPC, Edge/Modular | Hyperscale | — | — | Drives staffing ratios, timeline multipliers, cost factors |
| `cxItLoad` | IT Load Capacity | number | 100–500,000 | 10,000 | 100 | kW | Total design IT load, not current load |
| `cxTierLevel` | Tier / Redundancy | select | Tier I (N), Tier II (N+1), Tier III (2N), Tier IV (2N+1) | Tier III (2N) | — | — | Drives testing rigor multiplier |
| `cxBuildingType` | Building Type | select | Purpose-Built, Warehouse Conversion, Modular/Prefab, Multi-Story | Purpose-Built | — | — | Affects civil commissioning scope |
| `cxLocation` | Location Region | select | Americas (USA), EMEA (Europe), APAC (Asia-Pacific), Middle East, Africa | Americas (USA) | — | — | Drives labor rates, compliance requirements |
| `cxCity` | City Market | select | 38+ cities (same as CAPEX) | — | — | — | Optional override for labor rates |

### 1.2 Input Section B: Cloud Company Profile (NEW — Unique to this calculator)

| Input ID | Label | Type | Options | Default | Notes |
|----------|-------|------|---------|---------|-------|
| `cxCloudProfile` | Cloud Company Standard | select | Generic (Industry Standard), Google Cloud, Microsoft Azure, AWS, Meta (Facebook), Oracle Cloud, Apple, OpenAI/Stargate, xAI (Colossus), NVIDIA DGX Cloud, Equinix (Colo), Digital Realty (Colo), CyrusOne (Colo), Custom | Generic | Auto-populates RFS requirements, PUE targets, testing rigor, sustainability mandates |

When a cloud profile is selected, the following fields auto-populate but remain editable:

| Auto-populated Field | Description |
|---------------------|-------------|
| PUE Target | Company-specific PUE commissioning target |
| Cooling Preference | Air / Liquid / Hybrid ratio |
| Power Density | kW per rack target |
| Redundancy Override | Company-specific redundancy model |
| Sustainability Mandates | Renewable %, water targets, carbon targets |
| Testing Rigor Level | Standard / Enhanced / Maximum |
| IST Requirements | TOAT, 72-hr soak, concurrent maintenance, fault tolerance |
| Certification Requirements | Uptime Tier, ISO 27001, SOC 2, PCI-DSS, etc. |
| Commissioning Methodology | Standard L0-L5 / Compressed / Fast-Track |

### 1.3 Input Section C: Infrastructure Configuration

| Input ID | Label | Type | Range | Default | Step | Notes |
|----------|-------|------|-------|---------|------|-------|
| `cxCoolingType` | Primary Cooling | select | CRAC (Air), CRAH (Air), In-Row (Air), RDHX (Rear-Door HX), DLC (Direct Liquid), Immersion, Hybrid (Air+DLC) | Hybrid (Air+DLC) | — | Drives mechanical Cx scope and timeline |
| `cxDlcPercent` | DLC Coverage % | range | 0–100 | 50 | 5 | Only shown if Hybrid selected. % of IT load on liquid cooling |
| `cxRackDensity` | Rack Power Density | select | Standard (5-8 kW), Medium (8-15 kW), High (15-30 kW), Ultra (30-60 kW), AI/GPU (60-140 kW), Next-Gen (140-300 kW) | High (15-30 kW) | — | Affects cooling Cx complexity |
| `cxRackCount` | Number of Racks | number | 10–50,000 | 500 | 10 | — |
| `cxUpsType` | UPS Configuration | select | Standalone Double-Conversion, Modular Scalable, Distributed Redundant, Rotary/DRUPS, Flywheel Hybrid, Grid-Direct (No UPS) | Modular Scalable | — | Grid-Direct only for xAI/Microsoft Fairwater profiles |
| `cxUpsRedundancy` | UPS Redundancy | select | N, N+1, 2N, 2N+1, 2(N+1), Distributed | N+1 | — | — |
| `cxGenConfig` | Generator Config | select | None, N, N+1, 2N, 2(N+1) | N+1 | — | — |
| `cxGenFuel` | Generator Fuel | select | Diesel, Natural Gas, Dual Fuel, HVO Biodiesel, Gas Turbine | Diesel | — | Gas Turbine for xAI/large AI profiles |
| `cxFuelAutonomy` | Fuel Autonomy | select | 8h, 24h, 48h, 72h, 168h (7d) | 48h | — | Drives fuel system Cx scope |
| `cxMvDistribution` | MV Distribution | select | Single Feed, Dual Feed (Same Sub), Dual Feed (Diverse Sub), On-Site Substation, Dedicated 132kV+ | Dual Feed (Diverse Sub) | — | — |
| `cxPowerDist` | LV Power Distribution | select | Overhead Busway, Underfloor, Cable Tray, Mixed, +/-400 VDC (Google) | Overhead Busway | — | +/-400 VDC only for Google/future profiles |
| `cxFireSuppression` | Fire Suppression | select | FM-200, Novec 1230, Inergen, N₂, Water Mist, Pre-Action Sprinkler, VESDA + Clean Agent | VESDA + Clean Agent | — | — |
| `cxFireAlarm` | Fire Detection | select | Conventional, Addressable, VESDA, VESDA + Addressable Hybrid | VESDA + Addressable Hybrid | — | — |
| `cxSecurityLevel` | Security Level | select | Standard (Card), Enterprise (Card+Bio), High Security (MFA+Mantrap), Maximum (Multi-Layer) | Enterprise (Card+Bio) | — | — |
| `cxBmsLevel` | BMS/DCIM Level | select | Basic Sensors, BMS Only, BMS + DCIM, Full DCIM + AI Optimization | BMS + DCIM | — | AI Optimization for Google profile |
| `cxNetworkEntry` | Network Entry | select | Single Path, Dual Path (Same Route), Dual Diverse Path, 3+ Diverse + MMR | Dual Diverse Path | — | — |
| `cxCablingType` | Structured Cabling | select | Copper (Cat6A), Hybrid (Fiber+Copper), All-Fiber, Pre-Terminated Trunks | Hybrid (Fiber+Copper) | — | — |

### 1.4 Input Section D: Commissioning Scope (Pro Only)

| Input ID | Label | Type | Range | Default | Step | Notes |
|----------|-------|------|-------|---------|------|-------|
| `cxPhaseScope` | Commissioning Phases | multi-checkbox | L0, L1, L2, L3, L4, L5, L6 | All checked | — | Allow selective phase inclusion |
| `cxThirdPartyCxa` | Third-Party CxA | toggle | Yes/No | Yes | — | Include independent commissioning agent |
| `cxCxaFeeModel` | CxA Fee Model | select | % of Construction, Fixed Fee, Time & Materials | % of Construction | — | — |
| `cxCxaFeePct` | CxA Fee % | range | 0.5–5.0 | 1.5 | 0.1 | % of total construction cost |
| `cxLoadBankOwner` | Load Bank Provider | select | CxA-Provided, Owner-Rented, Contractor-Provided | CxA-Provided | — | Affects equipment cost allocation |
| `cxSoakTestDuration` | IST Soak Test Duration | select | 24h, 48h, 72h, 168h (7d) | 72h | — | Full-load soak test duration |
| `cxConcurrentMaintTest` | Concurrent Maintenance Test | toggle | Yes/No | Yes (if Tier III+) | — | Required for Tier III+ |
| `cxFaultToleranceTest` | Fault Tolerance Test | toggle | Yes/No | Yes (if Tier IV) | — | Required for Tier IV |
| `cxToatRequired` | TOAT Required | toggle | Yes/No | Yes | — | Total Outage Acceptance Test |

### 1.5 Input Section E: Sustainability & Certification (Pro Only)

| Input ID | Label | Type | Options | Default | Notes |
|----------|-------|------|---------|---------|-------|
| `cxUptimeCert` | Uptime Institute Certification | select | None, TCDD Only, TCDD + TCCF, TCDD + TCCF + TCOS | None | Adds certification testing and audit costs |
| `cxIso27001` | ISO 27001 | toggle | Yes/No | No | — |
| `cxSoc2` | SOC 2 Type II | toggle | Yes/No | No | — |
| `cxPciDss` | PCI-DSS | toggle | Yes/No | No | — |
| `cxLeed` | LEED Certification | select | None, Silver, Gold, Platinum | None | Adds sustainability commissioning |
| `cxRenewableTarget` | Renewable Energy % at RFS | range | 0–100 | 0 | 5 | Commissioning must verify PPA/renewable integration |
| `cxWaterTarget` | Water Usage Target | select | No Target, Standard (<2.0 L/kWh), Efficient (<1.0 L/kWh), Zero-Water | No Target | — | Microsoft Fairwater = Zero-Water |
| `cxCarbonTarget` | Carbon Target | select | No Target, Carbon Neutral, Carbon Negative, Net Zero | No Target | — | — |

### 1.6 Input Section F: Cost Parameters (Pro Only)

| Input ID | Label | Type | Range | Default | Step | Notes |
|----------|-------|------|-------|---------|------|-------|
| `cxConstructionCost` | Total Construction Cost | number | $1M–$50B | Auto-calculated | $1M | Can link to CAPEX calculator output or enter manually |
| `cxLaborModel` | Labor Model | select | In-House Cx Team, Third-Party CxA, Hybrid (Owner + CxA), EPC Turnkey | Hybrid | — | Drives staffing costs |
| `cxProjectionYear` | Projection Year | select | 2025, 2026, 2027, 2028, 2029, 2030 | 2026 | — | Cost escalation multiplier |
| `cxContingency` | Contingency % | range | 5–25 | 10 | 1 | Applied to total Cx cost |
| `cxEquipLeadTime` | Equipment Lead Time Factor | select | Standard (2025), Extended (+20%), Critical (+40%) | Standard | — | Affects timeline and cost |

### 1.7 Input Section G: Scenario Presets (Quick-Start)

| Preset Name | Facility Type | IT Load | Tier | Cooling | Cloud Profile | Description |
|------------|---------------|---------|------|---------|---------------|-------------|
| Enterprise Standard | Enterprise | 2 MW | Tier III | CRAH | Generic | Standard enterprise DC |
| Colo Multi-Tenant | Colocation | 10 MW | Tier III | In-Row + RDHX | Equinix | Multi-tenant colocation |
| Hyperscale Cloud | Hyperscale | 50 MW | Tier III+ | Hybrid DLC | AWS | Standard hyperscaler build |
| AI/GPU Cluster | AI/HPC | 100 MW | Tier III | DLC 85% | NVIDIA DGX | GPU-optimized AI facility |
| Stargate-Class | AI/HPC | 200 MW | Custom | DLC 100% | OpenAI/Stargate | Mega-scale AI campus |
| xAI Fast-Track | AI/HPC | 150 MW | Custom | DLC + Mobile | xAI | Compressed timeline build |
| Google TPU Campus | Hyperscale | 80 MW | Custom | DLC 50% | Google Cloud | Google-standard AI facility |
| Azure Fairwater | AI/HPC | 48 MW | Custom | Zero-Water DLC | Microsoft Azure | Microsoft next-gen AI DC |
| Meta OCP Campus | Hyperscale | 60 MW | Custom | Hybrid | Meta | Meta OCP-standard build |
| Edge Micro-DC | Edge/Modular | 0.5 MW | Tier II | CRAC | Generic | Edge/modular deployment |

---

## 2. Cloud Company RFS Profiles

### 2.1 Profile Data Structure

```javascript
const CLOUD_PROFILES = {
  generic: {
    name: 'Generic (Industry Standard)',
    icon: 'fa-industry',
    color: '#64748b',
    rfsTimeline: { // months from construction start to RFS
      enterprise: 14, colo: 16, hyperscale: 22, aiHpc: 28, edge: 6
    },
    pueTarget: 1.40,
    coolingPreference: 'hybrid', // air, liquid, hybrid, immersion
    dlcPercent: 30,
    powerDensity: 15, // kW per rack
    redundancy: { ups: 'n1', gen: 'n1', cooling: 'n1', network: 'dual_diverse' },
    sustainability: {
      renewablePercent: 0,
      waterTarget: 'none', // none, standard, efficient, zero
      carbonTarget: 'none' // none, neutral, negative, netzero
    },
    testingRigor: 'standard', // standard, enhanced, maximum
    istRequirements: {
      toat: true,
      soakTestHours: 72,
      concurrentMaint: true, // if Tier III+
      faultTolerance: false, // if Tier IV
      heatLoadTest: true,
      generatorBlackStart: true
    },
    certifications: [],
    methodology: 'standard', // standard, compressed, fasttrack
    staffingMultiplier: 1.0,
    costMultiplier: 1.0,
    timelineMultiplier: 1.0,
    notes: 'Industry-standard L0-L5 commissioning framework per ASHRAE Guideline 0 and Uptime Institute best practices.'
  },

  google: {
    name: 'Google Cloud',
    icon: 'fa-google',
    color: '#4285f4',
    rfsTimeline: {
      enterprise: null, colo: null, hyperscale: 20, aiHpc: 26, edge: null
    },
    pueTarget: 1.08,
    coolingPreference: 'hybrid',
    dlcPercent: 50, // ~50% of global fleet liquid-cooled (~1 GW)
    powerDensity: 100, // current TPU pods; roadmap >500 kW
    redundancy: { ups: '2n', gen: 'n1', cooling: 'n1', network: 'dual_diverse' },
    sustainability: {
      renewablePercent: 100, // 100% match since 2017; goal: 24/7 CFE
      waterTarget: 'efficient', // Water-cooled DCs use ~10% less energy
      carbonTarget: 'netzero' // 24/7 Carbon-Free Energy goal
    },
    testingRigor: 'maximum',
    istRequirements: {
      toat: true,
      soakTestHours: 72,
      concurrentMaint: true,
      faultTolerance: true,
      heatLoadTest: true,
      generatorBlackStart: true,
      aiCoolingVerification: true, // DeepMind AI cooling agent validation
      cduRedundancyTest: true // CDU N+1 failover per 99.999% target
    },
    certifications: ['iso27001', 'soc2'],
    methodology: 'standard',
    staffingMultiplier: 1.15, // Higher due to proprietary system integration
    costMultiplier: 1.20, // Premium for Google-specific standards
    timelineMultiplier: 1.0,
    proprietaryTools: [
      'DeepMind AI cooling agent (21-variable sensor system)',
      'Digital twin simulation',
      '+/-400 VDC power distribution verification',
      'Project Deschutes CDU (2 MW class, 80 PSI)',
      'Project Mt. Diablo disaggregated power rack'
    ],
    notes: 'Google commissioning processes and RFS checklists are proprietary (NDA-restricted). PUE 1.09 global fleet average (2024). Best site: 1.04 (Ohio). DeepMind AI achieved 40% cooling energy reduction. ~50% of global fleet liquid-cooled. Targets >500 kW/rack and 1 MW/rack with +/-400 VDC before 2030.'
  },

  microsoft: {
    name: 'Microsoft Azure',
    icon: 'fa-microsoft',
    color: '#00a4ef',
    rfsTimeline: {
      enterprise: null, colo: null, hyperscale: 18, aiHpc: 24, edge: null
    },
    pueTarget: 1.12, // Design PUE; best 1.11 Wyoming; Fairwater target 1.08
    coolingPreference: 'liquid', // Fairwater = zero-water chip-level cooling
    dlcPercent: 80,
    powerDensity: 140, // GB200/GB300 NVL72 = 136-140 kW/rack
    redundancy: {
      ups: '2n', // Standard; Fairwater = grid-direct (no UPS for GPU fleet)
      gen: 'n1',
      cooling: 'n1',
      network: 'dual_diverse',
      variants: {
        standard: { ups: '2n', description: '2N with independent busway pairs (A/B)' },
        catcher: { ups: 'n1_sts', description: 'N+1 with 3x1 MW UPS + STS' },
        fourN3R: { ups: '4n3r', description: '4 independent power systems, 3 needed' },
        fairwater: { ups: 'grid_direct', description: 'No traditional UPS for GPU fleet; 4x9 grid availability' }
      }
    },
    sustainability: {
      renewablePercent: 100, // 100/100/0 target by 2030
      waterTarget: 'zero', // Fairwater: zero water for cooling; avoids 125M+ liters/year/DC
      carbonTarget: 'negative' // Carbon negative by 2030 (all 3 scopes)
    },
    testingRigor: 'enhanced',
    istRequirements: {
      toat: true,
      soakTestHours: 72,
      concurrentMaint: true,
      faultTolerance: true, // For 4N3R config
      heatLoadTest: true,
      generatorBlackStart: true,
      compassStageGates: true, // Dynamics 365 Compass tool enforces phase gates
      zeroWaterVerification: true // Fairwater: verify no evaporative water use
    },
    certifications: ['iso27001', 'soc2'],
    methodology: 'standard',
    staffingMultiplier: 1.10,
    costMultiplier: 1.15,
    timelineMultiplier: 0.90, // Compass tool improves efficiency
    proprietaryTools: [
      'Compass (Dynamics 365) — procurement, cost, safety, commissioning management',
      'Stage-gated phase enforcement',
      'Mt. Diablo open rack design (joint with Meta/Google via OCP)',
      'Fairwater zero-water cooling HXU',
      'Direct 3-phase 480V AC to rack (eliminates UPS step-down)'
    ],
    notes: 'Microsoft Compass tool built on Dynamics 365 manages entire construction/commissioning lifecycle. Fairwater AI DCs use zero-water chip-level cooling, avoiding 125M+ liters/year. Carbon negative by 2030. Diesel-free by 2030. Three Mile Island 837 MW nuclear PPA ($1.6B restart). WUE 0.30 L/kWh (39% improvement from 2021). 2026 CAPEX ~$120B+.'
  },

  aws: {
    name: 'Amazon Web Services',
    icon: 'fa-aws',
    color: '#ff9900',
    rfsTimeline: {
      enterprise: null, colo: null, hyperscale: 20, aiHpc: 24, edge: null
    },
    pueTarget: 1.15, // 2024 global; best 1.04 Europe; target 1.08 new
    coolingPreference: 'hybrid',
    dlcPercent: 60,
    powerDensity: 60, // Current; 6x increase planned in 2 years then 3x more
    redundancy: { ups: 'n1', gen: 'n1', cooling: 'n1', network: 'dual_diverse' },
    sustainability: {
      renewablePercent: 100, // 100% renewable match by 2025 goal
      waterTarget: 'efficient', // WUE 0.15 L/kWh (IRHX platform)
      carbonTarget: 'netzero' // Net zero by 2040
    },
    testingRigor: 'enhanced',
    istRequirements: {
      toat: true,
      soakTestHours: 72,
      concurrentMaint: true,
      faultTolerance: false,
      heatLoadTest: true,
      generatorBlackStart: true,
      orrProcess: true, // Operational Readiness Review integrated into SDLC
      coeIntegration: true // Correction of Errors closed-loop feedback
    },
    certifications: ['iso27001', 'soc2', 'pci_dss'],
    methodology: 'standard', // Project Rainier achieved compressed: 13 months
    staffingMultiplier: 1.05,
    costMultiplier: 1.10,
    timelineMultiplier: 0.85, // Rainier showed compressed timelines possible
    proprietaryTools: [
      'ACx (AWS Commissioning) — independent business unit within DCGS',
      'ORR (Operational Readiness Review) — lifecycle review process',
      'COE (Correction of Errors) — post-incident analysis driving ORR updates',
      'AWS Well-Architected Tool with Custom Lens',
      'IRHX platform (July 2025) — 46% mechanical energy reduction',
      'Custom liquid cooling built in 11 months'
    ],
    notes: 'AWS ACx is a wholly independent business unit. ORR built into entire SDLC with weekly metrics meetings attended by thousands of engineers up to SVP level. Project Rainier: $11B, 30 buildings, 2.2 GW planned, 500K Trainium2 chips. 13 months construction-to-first-buildings. 4 GCs deployed simultaneously. WUE 0.15 L/kWh. 2026 CAPEX ~$200B.'
  },

  meta: {
    name: 'Meta (Facebook)',
    icon: 'fa-meta',
    color: '#0668e1',
    rfsTimeline: {
      enterprise: null, colo: null, hyperscale: 24, aiHpc: 30, edge: null
    },
    pueTarget: 1.08, // 2024: 1.08-1.09; original Prineville: 1.07
    coolingPreference: 'hybrid',
    dlcPercent: 40,
    powerDensity: 92, // OCP HPR 92+ kW; targeting 100+ kW
    redundancy: { ups: '2n', gen: 'n1', cooling: 'n1', network: 'dual_diverse' },
    sustainability: {
      renewablePercent: 100,
      waterTarget: 'efficient', // Water positive by 2030
      carbonTarget: 'netzero' // Net zero by 2030
    },
    testingRigor: 'enhanced',
    istRequirements: {
      toat: true,
      soakTestHours: 72,
      concurrentMaint: true,
      faultTolerance: false,
      heatLoadTest: true,
      generatorBlackStart: true,
      phasedDeliveryTest: true, // Commission data halls while rest under construction
      ocpComplianceTest: true // Open Compute Project hardware verification
    },
    certifications: ['iso27001', 'soc2', 'leed_gold'],
    methodology: 'standard',
    staffingMultiplier: 1.05,
    costMultiplier: 1.10,
    timelineMultiplier: 1.0,
    proprietaryTools: [
      'OCP Open Rack V3.1 (21" width) compliance verification',
      'OCP HPR 92+ kW rack testing',
      '277/480 VAC distribution verification',
      '48 VDC battery system testing',
      'Mt. Diablo disaggregated rack (joint with Google/Microsoft)',
      'Phased data hall delivery — zone-by-zone commissioning'
    ],
    notes: 'Meta uses phased delivery: commission data halls + install networking + test power in parallel, before entire site is complete. OCP Open Rack V3.1 standard. HPR 92+ kW racks. Planning 10+ GW capacity by end of 2026. Richland Parish LA: 4M+ sq ft AI campus. Low-carbon concrete in construction. LEED Gold+. 2026 CAPEX >$100B.'
  },

  oracle: {
    name: 'Oracle Cloud (OCI)',
    icon: 'fa-database',
    color: '#f80000',
    rfsTimeline: {
      enterprise: null, colo: 12, hyperscale: 16, aiHpc: 18, edge: null
    },
    pueTarget: 1.25, // Not publicly disclosed; industry estimate for leased DCs
    coolingPreference: 'hybrid',
    dlcPercent: 50,
    powerDensity: 60,
    redundancy: { ups: 'n1', gen: 'n1', cooling: 'n1', network: 'dual_diverse' },
    sustainability: {
      renewablePercent: 50,
      waterTarget: 'none',
      carbonTarget: 'neutral'
    },
    testingRigor: 'standard',
    istRequirements: {
      toat: true,
      soakTestHours: 48,
      concurrentMaint: true,
      faultTolerance: false,
      heatLoadTest: true,
      generatorBlackStart: true,
      distributedCloudTest: true // Cloud@Customer fully disconnectable verification
    },
    certifications: ['iso27001', 'soc2', 'pci_dss'],
    methodology: 'compressed', // Oracle leases most DCs; fast deployment
    staffingMultiplier: 0.90,
    costMultiplier: 0.95,
    timelineMultiplier: 0.80, // Abilene Phase 1 in ~15 months; 400 MW in single quarter
    proprietaryTools: [
      'Cloud@Customer disconnectable verification',
      'Distributed cloud testing (160+ DCs)',
      'Stargate joint venture coordination'
    ],
    notes: 'Oracle leases most DCs (variable commissioning scope). Stargate primary infrastructure partner: leading 3 of 5 new sites; 4.5 GW agreement. Abilene Phase 1 ~15 months; 400 MW stood up in single quarter. Cost: ~$5.5M/MW infrastructure; ~$12.5-16.5M/MW fully loaded. 2026 CAPEX growing to ~$35B.'
  },

  apple: {
    name: 'Apple',
    icon: 'fa-apple',
    color: '#555555',
    rfsTimeline: {
      enterprise: null, colo: null, hyperscale: 30, aiHpc: 36, edge: null
    },
    pueTarget: 1.20, // Not publicly disclosed; industry estimate
    coolingPreference: 'air', // Outside air (75% chiller reduction)
    dlcPercent: 10,
    powerDensity: 15,
    redundancy: { ups: '2n', gen: 'n1', cooling: 'n1', network: 'dual_diverse' },
    sustainability: {
      renewablePercent: 100, // 100% renewable from Day 1
      waterTarget: 'zero', // Water-free cooling designs
      carbonTarget: 'neutral' // Carbon neutral operations
    },
    testingRigor: 'enhanced',
    istRequirements: {
      toat: true,
      soakTestHours: 72,
      concurrentMaint: true,
      faultTolerance: false,
      heatLoadTest: true,
      generatorBlackStart: true,
      renewableVerification: true, // 100% renewable from Day 1 verification
      leedPlatinumAudit: true, // LEED Platinum certification
      wasteHeatRecapture: true // District heating integration test
    },
    certifications: ['iso27001', 'leed_platinum'],
    methodology: 'standard',
    staffingMultiplier: 1.20, // Higher due to sustainability requirements
    costMultiplier: 1.30, // Premium for LEED Platinum + 100% renewable from Day 1
    timelineMultiplier: 1.30, // Historically slow (Waukee IA took 8+ years)
    proprietaryTools: [
      'Renewable energy verification from Day 1',
      'Outside air cooling verification (75% chiller reduction)',
      'Waste heat recapture system testing',
      'LEED Platinum commissioning audit'
    ],
    notes: 'Apple requires 100% renewable energy from Day 1 of operations. LEED Platinum certification. Water-free cooling designs. Waste heat recapture for district heating. Historically longer timelines (Waukee IA: 8+ years). $10B over 5 years in US DC construction.'
  },

  stargate: {
    name: 'OpenAI / Stargate',
    icon: 'fa-bolt',
    color: '#10a37f',
    rfsTimeline: {
      enterprise: null, colo: null, hyperscale: null, aiHpc: 15, edge: null
    },
    pueTarget: 1.10,
    coolingPreference: 'liquid', // Direct-to-chip closed-loop; zero-water-evaporation
    dlcPercent: 100,
    powerDensity: 140, // 100-150 kW per rack; GB200 NVL72
    redundancy: { ups: 'n1', gen: 'n1', cooling: 'n1', network: 'dual_diverse' },
    sustainability: {
      renewablePercent: 50, // Solar + battery (1 GW/4 GWh)
      waterTarget: 'zero', // Zero-water-evaporation; ~12,000 gal/year/building after initial fill
      carbonTarget: 'neutral'
    },
    testingRigor: 'maximum',
    istRequirements: {
      toat: true,
      soakTestHours: 72,
      concurrentMaint: true,
      faultTolerance: false,
      heatLoadTest: true,
      generatorBlackStart: true,
      liquidCoolingStressTest: true, // Winter 2026 event response: cold-weather resilience
      gpuClusterBurnIn: true, // GPU cluster full-load burn-in
      batteryFailoverTest: true // 1 GW/4 GWh Tesla Megapack failover
    },
    certifications: [],
    methodology: 'compressed',
    staffingMultiplier: 1.30, // 6,400+ construction workers at peak
    costMultiplier: 1.25,
    timelineMultiplier: 0.65, // 15 months construction to first buildings
    proprietaryTools: [
      'Direct-to-chip closed-loop liquid cooling verification',
      'Zero-water-evaporation cooling validation',
      'GPU cluster burn-in testing (450,000+ GB200 GPUs)',
      '360 MW gas turbine commissioning',
      '1 GW/4 GWh battery system commissioning',
      'Cold-weather resilience testing (lessons from Winter 2026 event)'
    ],
    notes: 'Stargate Abilene: $500B total program (10 GW US target). Phase 1: 8 buildings, 1.2 GW, 450K+ GB200 GPUs. 15 months groundbreaking to operational. Cost: ~$5.5M/MW infrastructure; ~$12.5-16.5M/MW fully loaded. Phase 1 ~$3.4B. Winter 2026 event knocked buildings offline (liquid cooling disruption) — now drives cold-weather resilience testing requirements.'
  },

  xai: {
    name: 'xAI (Colossus)',
    icon: 'fa-rocket',
    color: '#1d9bf0',
    rfsTimeline: {
      enterprise: null, colo: null, hyperscale: null, aiHpc: 6, edge: null
    },
    pueTarget: 1.18, // Achieved; targeting 1.10
    coolingPreference: 'liquid',
    dlcPercent: 90,
    powerDensity: 100,
    redundancy: {
      ups: 'n', // Minimal traditional redundancy for fast-track
      gen: 'n1', // Gas turbine fleet (Solaris Energy 600 MW)
      cooling: 'n1',
      network: 'dual_diverse'
    },
    sustainability: {
      renewablePercent: 0, // Gas turbine fleet initially; grid connection later
      waterTarget: 'none',
      carbonTarget: 'none'
    },
    testingRigor: 'standard', // Compressed timeline = reduced testing scope
    istRequirements: {
      toat: false, // Fast-track may skip full TOAT
      soakTestHours: 24, // Compressed
      concurrentMaint: false,
      faultTolerance: false,
      heatLoadTest: true,
      generatorBlackStart: true,
      gpuClusterBurnIn: true,
      mobileCoolingIntegration: true, // 25% of US mobile cooling capacity leased
      gasTurbineSync: true // Solaris Energy 600 MW fleet synchronization
    },
    certifications: [],
    methodology: 'fasttrack',
    staffingMultiplier: 1.50, // Premium for compressed timeline
    costMultiplier: 1.40, // Premium for fast-track (mobile cooling, overtime)
    timelineMultiplier: 0.30, // 122 days! (vs. 18-24 months standard)
    proprietaryTools: [
      'Repurposed industrial building conversion verification',
      'Mobile cooling fleet integration (25% of US mobile cooling)',
      'Solaris Energy 600 MW gas turbine fleet commissioning',
      'GPU cluster rapid burn-in (19 days rack-to-training)',
      'Parallel workstream coordination',
      'Fast-tracked permit/approval integration'
    ],
    notes: 'FASTEST DC BUILD IN HISTORY: 100K GPUs in 122 days; doubled to 200K in 92 more days; 19 days rack-to-training. Repurposed Electrolux factory. Leased 25% of US mobile cooling capacity. Solaris Energy 600 MW gas turbine fleet; 400 MW currently serving xAI. Current: 230K GPUs (H100+H200+GB200); expanding to 555K GPUs / 2 GW. $18B GPU procurement; $80M site acquisition; $659M building permit.'
  },

  nvidia: {
    name: 'NVIDIA DGX Cloud',
    icon: 'fa-microchip',
    color: '#76b900',
    rfsTimeline: {
      enterprise: null, colo: null, hyperscale: null, aiHpc: 14, edge: null
    },
    pueTarget: 1.10,
    coolingPreference: 'liquid', // DLC-2 mandatory; 98% heat capture
    dlcPercent: 98,
    powerDensity: 140, // GB200 NVL72: 120-140 kW per rack
    redundancy: {
      ups: 'n1',
      gen: 'n1',
      cooling: 'n1',
      network: 'triple', // 3 power sources per rack
      rackPower: '3_sources' // NVIDIA requires 3 power sources per rack
    },
    sustainability: {
      renewablePercent: 50,
      waterTarget: 'efficient',
      carbonTarget: 'neutral'
    },
    testingRigor: 'maximum',
    istRequirements: {
      toat: true,
      soakTestHours: 72,
      concurrentMaint: true,
      faultTolerance: false,
      heatLoadTest: true,
      generatorBlackStart: true,
      dlc2Verification: true, // DLC-2 closed-loop verification
      fluidQualityTest: true, // Coolant chemistry and filtration
      nvlinkBurnIn: true, // NVLink/InfiniBand topology verification
      floorLoadTest: true // Reinforced flooring for 1,200+ lb racks
    },
    certifications: ['iso27001', 'soc2'],
    methodology: 'standard',
    staffingMultiplier: 1.25, // Specialized DLC and GPU commissioning
    costMultiplier: 1.30, // $5-10M upgrade cost for even one NVL72 rack
    timelineMultiplier: 0.90,
    rackSpecifications: {
      gb200_nvl72: {
        power: '120-140 kW',
        weight: '1,200+ lbs (544+ kg)',
        cooling: 'DLC-2 mandatory (98% heat capture)',
        dimensions: '42U, custom depth',
        networkPerRack: 'NVLink5 + InfiniBand XDR 800G',
        powerSources: 3, // Required minimum
        voltage: '480V 3-phase',
        floorLoad: '2,000+ lbs/sq ft reinforced'
      },
      gb300_rubin: {
        power: '250-600 kW (provision recommended)',
        weight: 'TBD',
        cooling: 'DLC-3 or immersion',
        dimensions: 'TBD',
        notes: 'Next-gen Rubin platform; recommend provisioning 250-600 kW per rack'
      }
    },
    proprietaryTools: [
      'DGX SuperPOD reference architecture validation',
      'DLC-2 closed-loop cooling verification',
      'Coolant chemistry management testing',
      'NVLink5 topology verification',
      'InfiniBand XDR 800G connectivity testing',
      'Floor load structural verification (2,000+ lbs/sq ft)',
      '480V 3-phase distribution to each rack',
      '3-source power redundancy per rack verification'
    ],
    notes: 'GB200 NVL72: 120-140 kW per rack, mandatory liquid cooling (DLC-2, 98% heat capture). Tier 3 minimum required. 3 power sources per rack. 480V distribution. Reinforced flooring. $5-10M to upgrade existing DC for even one NVL72 rack. GB300/Rubin = 250-600 kW per rack provisioning recommended. Deployment: 12-15 months total (6-9 months lead + 3-4 months facility prep + 2-3 weeks install + 2-3 months software).'
  },

  equinix: {
    name: 'Equinix (Colocation)',
    icon: 'fa-building',
    color: '#ed1c24',
    rfsTimeline: {
      enterprise: null, colo: 10, hyperscale: 14, aiHpc: 18, edge: null
    },
    pueTarget: 1.39, // 2024 global average
    coolingPreference: 'hybrid',
    dlcPercent: 20,
    powerDensity: 30, // Up to 100 kW per rack available
    redundancy: { ups: '2n', gen: 'n1', cooling: 'n1', network: 'dual_diverse' },
    sustainability: {
      renewablePercent: 96, // 96% renewable coverage (2024)
      waterTarget: 'standard',
      carbonTarget: 'neutral' // Climate neutral by 2030
    },
    testingRigor: 'enhanced',
    istRequirements: {
      toat: true,
      soakTestHours: 72,
      concurrentMaint: true,
      faultTolerance: false,
      heatLoadTest: true,
      generatorBlackStart: true,
      multiTenantIsolation: true, // Tenant isolation verification
      crossConnectTest: true, // Meet-me room / cross-connect verification
      slaVerification: true // 99.9999% uptime SLA verification
    },
    certifications: ['iso27001', 'soc2', 'pci_dss', 'hipaa'],
    methodology: 'standard',
    staffingMultiplier: 1.0,
    costMultiplier: 1.05,
    timelineMultiplier: 1.0,
    proprietaryTools: [
      'Multi-tenant isolation testing',
      'Cross-connect and meet-me room verification',
      '99.9999% uptime SLA compliance verification',
      'Third-party audit coordination (ISO/SOC/PCI)',
      'Tenant power metering accuracy verification'
    ],
    notes: 'Equinix: PUE 1.39 global average. N+1+ redundancy. 99.9999% uptime. 260 DCs globally. Up to 100 kW per rack. ISO 27001/SOC2/PCI-DSS mandatory. Independent third-party audits required. L5 IST before any tenant deployment.'
  },

  digitalRealty: {
    name: 'Digital Realty (Colocation)',
    icon: 'fa-server',
    color: '#003da5',
    rfsTimeline: {
      enterprise: null, colo: 12, hyperscale: 16, aiHpc: 20, edge: null
    },
    pueTarget: 1.30,
    coolingPreference: 'hybrid',
    dlcPercent: 25,
    powerDensity: 30,
    redundancy: { ups: '2n', gen: 'n1', cooling: 'n1', network: 'dual_diverse' },
    sustainability: {
      renewablePercent: 80,
      waterTarget: 'standard',
      carbonTarget: 'neutral'
    },
    testingRigor: 'enhanced',
    istRequirements: {
      toat: true,
      soakTestHours: 72,
      concurrentMaint: true,
      faultTolerance: false,
      heatLoadTest: true,
      generatorBlackStart: true,
      multiTenantIsolation: true
    },
    certifications: ['iso27001', 'soc1', 'soc2'],
    methodology: 'standard',
    staffingMultiplier: 1.0,
    costMultiplier: 1.0,
    timelineMultiplier: 1.0,
    notes: 'Digital Realty: PUE ~1.30 baseline. SOC1/SOC2/ISO 27001 mandatory. Larger enterprise focus. Standard L0-L5 commissioning.'
  },

  cyrusone: {
    name: 'CyrusOne (Colocation)',
    icon: 'fa-shield-halved',
    color: '#0072bc',
    rfsTimeline: {
      enterprise: null, colo: 10, hyperscale: 14, aiHpc: 18, edge: null
    },
    pueTarget: 1.25,
    coolingPreference: 'hybrid',
    dlcPercent: 30,
    powerDensity: 40, // 250-900 W/sq ft
    redundancy: { ups: '2n', gen: 'n1', cooling: 'n1', network: 'dual_diverse' },
    sustainability: {
      renewablePercent: 60,
      waterTarget: 'standard',
      carbonTarget: 'neutral'
    },
    testingRigor: 'enhanced',
    istRequirements: {
      toat: true,
      soakTestHours: 72,
      concurrentMaint: true,
      faultTolerance: false,
      heatLoadTest: true,
      generatorBlackStart: true,
      multiTenantIsolation: true
    },
    certifications: ['iso27001', 'iso14001', 'iso45001', 'iso50001', 'soc1', 'soc2'],
    methodology: 'standard',
    staffingMultiplier: 1.0,
    costMultiplier: 1.0,
    timelineMultiplier: 1.0,
    notes: 'CyrusOne: ISO 27001/14001/45001/50001 + SOC1/SOC2. 250-900 W/sq ft. Flexible N or 2N power. Standard L0-L5 commissioning with independent third-party audits.'
  }
};
```

### 2.2 Comparative Summary Table

| Company | RFS (AI/HPC) | PUE Target | Power Density | DLC % | Redundancy | Renewable % | Methodology | Cost Mult | Timeline Mult |
|---------|-------------|-----------|--------------|-------|------------|-------------|-------------|-----------|--------------|
| Generic | 28 mo | 1.40 | 15 kW | 30% | N+1 | 0% | Standard | 1.00x | 1.00x |
| Google | 26 mo | 1.08 | 100 kW | 50% | 2N UPS | 100% | Standard | 1.20x | 1.00x |
| Microsoft | 24 mo | 1.12 | 140 kW | 80% | 2N/4N3R | 100% | Standard | 1.15x | 0.90x |
| AWS | 24 mo | 1.15 | 60 kW | 60% | N+1 | 100% | Standard | 1.10x | 0.85x |
| Meta | 30 mo | 1.08 | 92 kW | 40% | 2N UPS | 100% | Standard | 1.10x | 1.00x |
| Oracle | 18 mo | 1.25 | 60 kW | 50% | N+1 | 50% | Compressed | 0.95x | 0.80x |
| Apple | 36 mo | 1.20 | 15 kW | 10% | 2N UPS | 100% | Standard | 1.30x | 1.30x |
| Stargate | 15 mo | 1.10 | 140 kW | 100% | N+1 | 50% | Compressed | 1.25x | 0.65x |
| xAI | 6 mo | 1.18 | 100 kW | 90% | N | 0% | Fast-Track | 1.40x | 0.30x |
| NVIDIA | 14 mo | 1.10 | 140 kW | 98% | N+1 (3-src) | 50% | Standard | 1.30x | 0.90x |
| Equinix | 18 mo | 1.39 | 30 kW | 20% | 2N UPS | 96% | Standard | 1.05x | 1.00x |
| Digital Realty | 20 mo | 1.30 | 30 kW | 25% | 2N UPS | 80% | Standard | 1.00x | 1.00x |
| CyrusOne | 18 mo | 1.25 | 40 kW | 30% | 2N UPS | 60% | Standard | 1.00x | 1.00x |

---

## 3. Complete RFS Requirement Categories — Full Expandable Hierarchy

> **Key insight from user**: RFS is NOT just commissioning testing. It is the COMPLETE set of requirements that must be satisfied before a data center can be declared "Ready for Service". This includes administrative, legal, operational, commercial, contractual, and supply chain readiness — far beyond technical commissioning.

The RFS calculator organizes all requirements into **10 major categories**, each with **expandable sub-categories**, each with **expandable individual items**, each with **expandable detail/checklist**. This is the 4-level expandable hierarchy.

### 3.1 Category Structure Overview

```
RFS READINESS TRACKER
├── A. Technical Commissioning (L0-L6)          ← 7 phases, ~180 test items
├── B. Project Closure & Documentation           ← 8 sub-categories, ~65 items
├── C. Certificates, Permits & Regulatory        ← 9 sub-categories, ~55 items
├── D. Standard Operating Procedures (SOPs)      ← 6 sub-categories, ~175 items
├── E. Spare Parts & Inventory                   ← 7 sub-categories, ~85 items
├── F. Maintenance Contracts                     ← 12 sub-categories, ~40 items
├── G. Fuel & Energy Contracts                   ← 5 sub-categories, ~25 items
├── H. Insurance & Risk                          ← 7 sub-categories, ~20 items
├── I. Staffing & Training                       ← 6 sub-categories, ~45 items
├── J. Customer/Tenant & Commercial Readiness    ← 8 sub-categories, ~50 items
└── TOTAL: ~740 individual checklist items
```

---

### 3.2 Category A: Technical Commissioning (L0-L6)

```
A. TECHNICAL COMMISSIONING
├── A1. L0 — Design & Planning
│   ├── A1.1 Commissioning Plan
│   │   ├── CxA selection & contract
│   │   ├── Cx schedule with milestones
│   │   ├── Cx budget allocation
│   │   ├── Roles & responsibilities matrix (RACI)
│   │   └── Communication & reporting plan
│   ├── A1.2 Design Review Documents
│   │   ├── Owner's Project Requirements (OPR) reviewed & signed
│   │   ├── Basis of Design (BOD) reviewed & signed
│   │   ├── Sequence of Operations (SOO) for all systems
│   │   ├── Design-for-testability review
│   │   ├── Safe energization pathway review
│   │   └── Installation sequencing plan
│   ├── A1.3 Controls & Automation Specs
│   │   ├── BMS graphic documents finalized
│   │   ├── BMS points list (all AI/AO/DI/DO)
│   │   ├── Fire Cause & Effect matrix
│   │   ├── Alarm priority matrix
│   │   └── EPMS metering architecture
│   └── A1.4 Factory Testing Plan
│       ├── FAT schedule per equipment type
│       ├── FAT witness requirements
│       ├── FAT acceptance criteria
│       └── FAT documentation templates
│
├── A2. L1 — Factory Acceptance Testing (Red Tag)
│   ├── A2.1 Electrical Equipment FAT
│   │   ├── MV switchgear FAT
│   │   ├── Transformer FAT (turns ratio, winding resistance, oil DGA)
│   │   ├── UPS FAT (load test, harmonic analysis, transfer time)
│   │   ├── Generator FAT (load bank, synchronization, black start)
│   │   ├── ATS/STS FAT (transfer time, make-before-break)
│   │   ├── PDU FAT (load balance, monitoring accuracy)
│   │   └── Busway/busduct FAT
│   ├── A2.2 Mechanical Equipment FAT
│   │   ├── Chiller FAT (capacity, COP, refrigerant charge)
│   │   ├── CRAH/CRAC FAT (airflow, temperature control)
│   │   ├── Cooling tower FAT
│   │   ├── Pump FAT (flow rate, head pressure)
│   │   ├── CDU FAT (for DLC systems — flow rate, pressure drop)
│   │   └── RDHX FAT (heat rejection capacity)
│   ├── A2.3 Fire Protection FAT
│   │   ├── VESDA FAT (sensitivity, response time)
│   │   ├── Clean agent system FAT (discharge timing)
│   │   ├── FACP FAT (programming, zone mapping)
│   │   └── Pre-action sprinkler FAT
│   ├── A2.4 Controls & BMS FAT
│   │   ├── BMS controller FAT
│   │   ├── EPMS meter FAT
│   │   └── DCIM software FAT
│   └── A2.5 Security Equipment FAT
│       ├── Access control system FAT
│       ├── CCTV system FAT
│       └── Intrusion detection FAT
│
├── A3. L2 — Delivery, Installation & Pre-Startup (Yellow Tag)
│   ├── A3.1 Delivery Inspection
│   │   ├── Shipping damage verification
│   │   ├── Nameplate data vs. specs verification
│   │   ├── Quantity and completeness check
│   │   └── Storage conditions verification
│   ├── A3.2 Installation Verification — Electrical
│   │   ├── Insulation resistance (Megger) — NETA Table 100.1 values
│   │   ├── Contact resistance (DLRO) — <500 µΩ
│   │   ├── Phase rotation verification
│   │   ├── CT/VT polarity check
│   │   ├── Breaker setting verification
│   │   ├── Torque verification on all bolted connections
│   │   ├── Grounding/earthing continuity
│   │   └── Cable routing and labeling verification
│   ├── A3.3 Installation Verification — Mechanical
│   │   ├── Pipework pressure test (1.5x operating pressure, 24h)
│   │   ├── Pipe flushing (5-8 ft/s, staged filtration 100→10 µm)
│   │   ├── Sensor placement verification
│   │   ├── Damper actuation verification
│   │   ├── Valve tagging and labeling
│   │   └── DLC coupling leak test (pressure decay + tracer gas)
│   ├── A3.4 Installation Verification — Fire
│   │   ├── Pipe routing verification
│   │   ├── Head spacing verification
│   │   ├── Agent quantity verification
│   │   └── Door fan test (room integrity — 10 min hold time)
│   └── A3.5 Installation Verification — Security & Network
│       ├── Camera placement vs. design
│       ├── Cable certification (Cat6A per TIA-568.2-D, fiber OTDR)
│       └── Access control hardware placement
│
├── A4. L3 — Pre-Functional / System Startup (Green Tag)
│   ├── A4.1 Electrical System Startup
│   │   ├── MV switchgear energization
│   │   ├── Transformer energization & DGA at 24h
│   │   ├── UPS energization & battery conditioning
│   │   ├── Generator first start & governor calibration
│   │   ├── ATS/STS first transfer test
│   │   ├── PDU energization & monitoring verification
│   │   └── EPMS first data collection verification
│   ├── A4.2 Mechanical System Startup
│   │   ├── Chiller first start & refrigerant charge verify
│   │   ├── CRAH/CRAC startup & airflow measurement
│   │   ├── Cooling tower startup & water treatment
│   │   ├── Pump startup (flow, vibration, alignment)
│   │   ├── CDU startup & fluid quality verification
│   │   └── Piping system chemical treatment initiation
│   ├── A4.3 Fire System Startup
│   │   ├── VESDA startup & baseline recording
│   │   ├── FACP startup & zone verification
│   │   ├── Clean agent system arming
│   │   └── EPO system arming
│   ├── A4.4 BMS/DCIM Startup
│   │   ├── Point-to-point verification (all AI/AO/DI/DO)
│   │   ├── Graphics display verification
│   │   ├── Trend data logging verification
│   │   └── Time synchronization across all controllers
│   └── A4.5 Security System Startup
│       ├── Access control enrollment & testing
│       ├── CCTV recording & PTZ verification
│       └── Intrusion detection arming
│
├── A5. L4 — Functional Performance Testing (Blue Tag)
│   ├── A5.1 Electrical FPT
│   │   ├── UPS load test (0/25/50/75/100% steps, 30-60 min each)
│   │   ├── UPS harmonic analysis (THD <5% per IEC 61000-3-4)
│   │   ├── UPS transfer time test (<4 ms STS, <10 ms ATS)
│   │   ├── UPS battery discharge test (full load, min 15 min)
│   │   ├── Generator load bank test (25/50/75/100%, 2h full load)
│   │   ├── Generator synchronization test (parallel operation)
│   │   ├── ATS transfer time verification
│   │   ├── PDU load balancing verification
│   │   ├── Thermal imaging under load (all connections)
│   │   ├── Power quality analysis (8-24h continuous logging)
│   │   └── Relay calibration verification (0/25/50/100% scale)
│   ├── A5.2 Mechanical FPT
│   │   ├── Chiller capacity verification (full design load)
│   │   ├── Chiller COP measurement
│   │   ├── CRAH/CRAC temperature control accuracy (±1°F)
│   │   ├── Cooling tower approach temperature test (5-10°F)
│   │   ├── Pump performance curve verification
│   │   ├── Vibration analysis on all rotating equipment
│   │   ├── CDU flow rate per server/rack verification
│   │   ├── CDU pressure drop test
│   │   ├── Cooling redundancy failover test (N+1)
│   │   └── Containment effectiveness test (hot/cold aisle)
│   ├── A5.3 Fire FPT
│   │   ├── VESDA response time test (all zones)
│   │   ├── Clean agent discharge timing verification (<10s)
│   │   ├── Pre-action sprinkler flow test
│   │   ├── EPO integration test (all power sources disconnected)
│   │   └── Cause & Effect matrix validation (every scenario)
│   ├── A5.4 BMS/DCIM FPT
│   │   ├── Alarm testing (all priorities, escalation, notification)
│   │   ├── Environmental monitoring accuracy
│   │   ├── Leak detection sensitivity test
│   │   ├── Energy metering accuracy verification (±1%)
│   │   └── Dashboard and reporting functionality
│   └── A5.5 Security FPT
│       ├── Multi-factor authentication test
│       ├── Mantrap dual-door interlock test
│       ├── CCTV coverage gap analysis
│       └── Intrusion detection response test
│
├── A6. L5 — Integrated Systems Testing (White Tag)
│   ├── A6.1 TOAT (Total Outage Acceptance Test)
│   │   ├── Baseline recording (all systems nominal)
│   │   ├── Utility power interruption
│   │   ├── Generator start and transfer verification
│   │   ├── Generator run under load (min 2 hours)
│   │   ├── Generator failure simulation (if 2N/N+1)
│   │   ├── Multiple generator failure (Tier IV)
│   │   ├── Utility power restoration sequence
│   │   └── Full system recovery verification
│   ├── A6.2 Heat Load / Soak Test
│   │   ├── Full-load operation (72h standard / 168h enhanced)
│   │   ├── Thermal imaging at intervals (0h, 24h, 48h, 72h)
│   │   ├── Fault injection during soak (mains fail, UPS bypass, cooling loss)
│   │   ├── Environmental monitoring throughout
│   │   └── PUE measurement at steady state
│   ├── A6.3 Concurrent Maintenance Test (Tier III+)
│   │   ├── Isolate each redundant power path — verify zero IT impact
│   │   ├── Isolate each redundant cooling path — verify zero IT impact
│   │   ├── BMS alarm verification during maintenance mode
│   │   └── Operations staff walkthrough
│   ├── A6.4 Fault Tolerance Test (Tier IV)
│   │   ├── Fail components WITHOUT warning — verify auto-failover
│   │   ├── Combined maintenance + fault scenario
│   │   ├── Multiple simultaneous failures
│   │   └── Zero impact verification on IT load
│   ├── A6.5 Fire Integration Test
│   │   ├── VESDA alarm → FACP → EPO → cooling shutdown sequence
│   │   ├── Power restoration after fire event
│   │   └── BMS alarm propagation verification
│   ├── A6.6 Generator Black Start Test
│   │   ├── Total grid loss simulation
│   │   ├── Generator cold start (no utility power)
│   │   ├── Load pickup sequence
│   │   └── Time-to-full-power measurement
│   └── A6.7 Cloud Company-Specific IST
│       ├── Google: DeepMind AI cooling verification, CDU N+1 failover
│       ├── Microsoft: Compass stage gate verification, zero-water verification
│       ├── AWS: ORR completion, COE integration check
│       ├── Meta: OCP compliance, phased delivery zone test
│       ├── Stargate: GPU cluster burn-in, cold-weather resilience, battery failover
│       ├── xAI: Mobile cooling integration, gas turbine synchronization
│       ├── NVIDIA: DLC-2 verification, 3-source power per rack, floor load test
│       └── Equinix/Colo: Multi-tenant isolation, cross-connect, SLA verification
│
└── A7. L6 — Closeout & Handover
    ├── A7.1 Documentation Package
    │   ├── Final Commissioning Report
    │   ├── All level close-out reports (L1-L5)
    │   ├── Test data and analysis
    │   └── Lessons Learned document
    ├── A7.2 Formal Handover
    │   ├── Handover meeting with all stakeholders
    │   ├── Key handover (physical and digital)
    │   ├── System access credentials transfer
    │   └── Warranty start date confirmation
    └── A7.3 Post-Handover Support
        ├── Deficiency/punch list resolution period (typically 30-90 days)
        ├── Performance monitoring period
        └── CxA availability for issue resolution
```

---

### 3.3 Category B: Project Closure & Documentation

```
B. PROJECT CLOSURE & DOCUMENTATION
├── B1. As-Built Drawings
│   ├── B1.1 Architectural as-builts (floor plans, elevations, sections)
│   ├── B1.2 Structural as-builts (foundations, steel, concrete)
│   ├── B1.3 Electrical as-builts (MV/LV SLD, panel schedules, cable routes)
│   ├── B1.4 Mechanical as-builts (piping P&IDs, cooling layouts, ductwork)
│   ├── B1.5 Fire protection as-builts (suppression layouts, detection zones)
│   ├── B1.6 Security as-builts (camera locations, access points, zones)
│   ├── B1.7 BMS/DCIM as-builts (controller locations, sensor placement, network)
│   ├── B1.8 Network/ICT as-builts (cable routes, patch panel schedules, fiber paths)
│   └── B1.9 Site as-builts (utilities, drainage, roads, landscaping)
│
├── B2. Equipment Documentation
│   ├── B2.1 O&M manuals for ALL systems (indexed and accessible)
│   ├── B2.2 Equipment datasheets and nameplate records
│   ├── B2.3 Warranty certificates (start date, duration, scope, contacts)
│   ├── B2.4 Equipment serial numbers and asset tags
│   ├── B2.5 Spare parts lists per equipment (OEM recommended)
│   ├── B2.6 Preventive maintenance schedules (OEM recommended intervals)
│   └── B2.7 Equipment lifecycle data (expected lifespan, replacement schedule)
│
├── B3. Test & Commissioning Records
│   ├── B3.1 All L1-L5 test reports with data
│   ├── B3.2 Punch list with resolution status (0 open critical items)
│   ├── B3.3 Deficiency log with resolution evidence
│   ├── B3.4 Load bank test records
│   ├── B3.5 Thermal imaging records
│   ├── B3.6 Power quality analysis records
│   ├── B3.7 Vibration analysis records
│   ├── B3.8 Water treatment analysis records
│   └── B3.9 NETA acceptance test reports (electrical)
│
├── B4. Construction Completion
│   ├── B4.1 Practical Completion Certificate (PCC)
│   ├── B4.2 Final Completion Certificate (FCC)
│   ├── B4.3 Defects Liability Period (DLP) agreement (typically 12-24 months)
│   ├── B4.4 Retention release schedule
│   ├── B4.5 Final account settlement
│   └── B4.6 Contractor demobilization confirmation
│
├── B5. Design & Engineering Records
│   ├── B5.1 Final design calculations (electrical, mechanical, structural)
│   ├── B5.2 Equipment selection records and alternatives considered
│   ├── B5.3 Value engineering log
│   ├── B5.4 Change order log with approvals
│   └── B5.5 Design-build coordination records (RFIs, submittals)
│
├── B6. Vendor/Supplier Records
│   ├── B6.1 Vendor contact directory (all equipment OEMs)
│   ├── B6.2 Supplier agreements and terms
│   ├── B6.3 OEM authorized service providers list
│   ├── B6.4 Emergency contact numbers (24/7)
│   └── B6.5 Parts ordering procedures per vendor
│
├── B7. BIM & Digital Twin
│   ├── B7.1 Updated BIM model (as-built)
│   ├── B7.2 Digital twin setup (if applicable)
│   ├── B7.3 Asset management system populated
│   └── B7.4 CMMS/CAFM system populated with all assets
│
└── B8. Training Records
    ├── B8.1 Operator training completion certificates
    ├── B8.2 Training materials and manuals
    ├── B8.3 Video recordings of key procedures
    └── B8.4 Competency assessment records
```

---

### 3.4 Category C: Certificates, Permits & Regulatory

```
C. CERTIFICATES, PERMITS & REGULATORY
├── C1. Building & Occupancy
│   ├── C1.1 Certificate of Occupancy (CO) / Temporary CO
│   ├── C1.2 Building permit final inspection sign-off
│   ├── C1.3 Structural engineer sign-off
│   ├── C1.4 Architect's certificate of completion
│   ├── C1.5 Accessibility compliance certificate (ADA/equivalent)
│   └── C1.6 Zoning compliance confirmation
│
├── C2. Electrical Certificates
│   ├── C2.1 Electrical installation certificate
│   ├── C2.2 NETA acceptance test certification
│   ├── C2.3 Grid connection agreement / Power purchase agreement
│   ├── C2.4 Transformer commissioning certificate
│   ├── C2.5 Generator emissions permit
│   ├── C2.6 UPS commissioning certificate
│   ├── C2.7 Lightning protection certificate
│   └── C2.8 Earthing/grounding test certificate
│
├── C3. Fire Safety Certificates
│   ├── C3.1 Fire safety certificate (local fire authority)
│   ├── C3.2 Fire suppression system commissioning certificate
│   ├── C3.3 VESDA commissioning certificate
│   ├── C3.4 Fire alarm system commissioning certificate
│   ├── C3.5 Fire door certification
│   ├── C3.6 Fire stopping/penetration seal certification
│   ├── C3.7 Evacuation plan approval
│   └── C3.8 Fire drill completion record
│
├── C4. Environmental Permits
│   ├── C4.1 Environmental Impact Assessment (EIA/AMDAL)
│   ├── C4.2 Air emissions permit (generator exhaust)
│   ├── C4.3 Water discharge permit
│   ├── C4.4 Noise emission permit/assessment
│   ├── C4.5 Hazardous materials storage permit (diesel, refrigerant, battery acid)
│   ├── C4.6 SPCC Plan (if >1,320 gal aggregate oil storage)
│   └── C4.7 Waste management license
│
├── C5. Health & Safety
│   ├── C5.1 Occupational health & safety certificate
│   ├── C5.2 Asbestos survey report (if brownfield)
│   ├── C5.3 Arc flash study completion & labels installed
│   ├── C5.4 Safety signage installation verification
│   ├── C5.5 First aid equipment and AED installation
│   ├── C5.6 PPE inventory stocked
│   └── C5.7 Emergency egress plan posted
│
├── C6. Industry Certifications
│   ├── C6.1 Uptime Institute TCDD (Tier Certification of Design Documents)
│   ├── C6.2 Uptime Institute TCCF (Tier Certification of Constructed Facility)
│   ├── C6.3 Uptime Institute TCOS (Tier Certification of Operational Sustainability)
│   ├── C6.4 ISO 27001 (Information Security Management)
│   ├── C6.5 ISO 14001 (Environmental Management)
│   ├── C6.6 ISO 45001 (Occupational Health & Safety)
│   ├── C6.7 ISO 50001 (Energy Management)
│   ├── C6.8 SOC 2 Type II audit completion
│   ├── C6.9 PCI-DSS certification (if applicable)
│   ├── C6.10 HIPAA compliance (if applicable)
│   ├── C6.11 LEED certification (if applicable)
│   └── C6.12 EN 50600 classification (EU)
│
├── C7. Regional/Country-Specific (Indonesia Example)
│   ├── C7.1 K3 Listrik (Electrical Safety) — Kemenaker
│   ├── C7.2 SLO (Sertifikat Laik Operasi) — PLN
│   ├── C7.3 Izin Operasi (Operating License) — ESDM
│   ├── C7.4 AMDAL (Environmental Impact) — KLHK
│   ├── C7.5 IMB/PBG (Building Permit) — Local government
│   ├── C7.6 BNSP operator certifications
│   ├── C7.7 OJK compliance (if financial services tenant)
│   └── C7.8 Kominfo data center registration (if public service)
│
├── C8. Telecom & Network
│   ├── C8.1 Telecom license / carrier agreements
│   ├── C8.2 Internet transit agreements
│   ├── C8.3 Peering agreements
│   ├── C8.4 Dark fiber IRU agreements
│   └── C8.5 Last-mile diversity verification
│
└── C9. Insurance Certificates
    ├── C9.1 Property insurance certificate (see Category H for details)
    ├── C9.2 Business interruption insurance certificate
    ├── C9.3 General liability insurance certificate
    ├── C9.4 Workers compensation insurance certificate
    └── C9.5 Builder's risk to property insurance transition
```

---

### 3.5 Category D: Standard Operating Procedures (SOPs)

> Based on Salute's STEP playbook framework (175+ SOPs) and Uptime Institute M&O criteria

```
D. STANDARD OPERATING PROCEDURES (SOPs)
├── D1. Governance & Management (25-30 SOPs)
│   ├── D1.1 Data center operations policy
│   ├── D1.2 Roles and responsibilities matrix
│   ├── D1.3 Shift handover procedure
│   ├── D1.4 Management of change (MOC) procedure
│   ├── D1.5 Risk assessment and management procedure
│   ├── D1.6 Incident management procedure
│   ├── D1.7 Problem management procedure
│   ├── D1.8 Escalation procedure (P1/P2/P3/P4 definitions)
│   ├── D1.9 Communication procedure (internal & external)
│   ├── D1.10 Vendor management procedure
│   ├── D1.11 Contract management procedure
│   ├── D1.12 Document control procedure
│   ├── D1.13 Audit and compliance procedure
│   ├── D1.14 KPI reporting and review procedure
│   ├── D1.15 Capacity management procedure
│   ├── D1.16 Asset lifecycle management procedure
│   ├── D1.17 Budget and financial management procedure
│   ├── D1.18 Continuous improvement procedure
│   ├── D1.19 Lessons learned procedure
│   └── D1.20 Management review meeting procedure
│
├── D2. Critical Facility Operations (40-50 SOPs)
│   ├── D2.1 Normal operations — Electrical
│   │   ├── Daily electrical walkthrough checklist
│   │   ├── UPS monitoring and alarm response
│   │   ├── Generator readiness check
│   │   ├── ATS/STS status monitoring
│   │   ├── Power quality monitoring
│   │   ├── PDU load balancing check
│   │   └── EPMS reading and logging
│   ├── D2.2 Normal operations — Mechanical
│   │   ├── Daily mechanical walkthrough checklist
│   │   ├── Chiller plant monitoring
│   │   ├── Cooling tower monitoring
│   │   ├── CRAH/CRAC monitoring
│   │   ├── CDU monitoring (DLC systems)
│   │   ├── Water treatment monitoring
│   │   └── Pump and valve status check
│   ├── D2.3 Normal operations — Fire & Safety
│   │   ├── Fire panel status check
│   │   ├── VESDA status monitoring
│   │   ├── Fire suppression system status
│   │   ├── EPO system status check
│   │   └── Emergency lighting check
│   ├── D2.4 Normal operations — BMS/DCIM
│   │   ├── BMS alarm review and acknowledgment
│   │   ├── Environmental monitoring review
│   │   ├── Trend data review
│   │   ├── DCIM dashboard review
│   │   └── Alarm threshold management
│   ├── D2.5 Normal operations — Security
│   │   ├── Security console monitoring
│   │   ├── Access log review
│   │   ├── CCTV footage review
│   │   ├── Perimeter patrol procedure
│   │   └── Badge inventory management
│   └── D2.6 Normal operations — Fuel
│       ├── Fuel level monitoring (daily)
│       ├── Fuel quality testing schedule
│       ├── Day tank level check
│       ├── Fuel transfer pump test
│       └── Fuel delivery receiving procedure
│
├── D3. Emergency Procedures (20-25 SOPs)
│   ├── D3.1 Power failure — complete utility loss
│   ├── D3.2 Power failure — partial/single feed loss
│   ├── D3.3 UPS failure procedure
│   ├── D3.4 Generator failure to start
│   ├── D3.5 Generator failure during operation
│   ├── D3.6 Cooling failure — single system
│   ├── D3.7 Cooling failure — complete cooling loss
│   ├── D3.8 Fire alarm response
│   ├── D3.9 Fire suppression activation response
│   ├── D3.10 Water leak response
│   ├── D3.11 Flood response
│   ├── D3.12 Earthquake response
│   ├── D3.13 Severe weather response (hurricane, tornado, extreme heat)
│   ├── D3.14 Security breach response
│   ├── D3.15 Bomb threat / suspicious package
│   ├── D3.16 Chemical/hazmat spill (diesel, refrigerant, battery acid)
│   ├── D3.17 Medical emergency
│   ├── D3.18 Building evacuation
│   ├── D3.19 IT security incident / cyber attack
│   ├── D3.20 Pandemic / mass casualty response
│   ├── D3.21 EPO activation and recovery
│   └── D3.22 Cascading failure response (multi-system)
│
├── D4. Maintenance Procedures (30-40 SOPs)
│   ├── D4.1 Preventive Maintenance (PM)
│   │   ├── PM schedule — Electrical systems
│   │   ├── PM schedule — Mechanical systems
│   │   ├── PM schedule — Fire systems
│   │   ├── PM schedule — Security systems
│   │   ├── PM schedule — BMS/DCIM
│   │   ├── PM schedule — Building fabric
│   │   ├── PM schedule — Grounds and exterior
│   │   └── PM work order creation and tracking
│   ├── D4.2 Corrective Maintenance
│   │   ├── Fault diagnosis procedure
│   │   ├── Repair/replace decision procedure
│   │   ├── Spare parts requisition procedure
│   │   ├── OEM service call procedure
│   │   └── Post-repair testing procedure
│   ├── D4.3 Predictive Maintenance
│   │   ├── Thermal imaging schedule and analysis
│   │   ├── Vibration analysis schedule
│   │   ├── Oil/fluid analysis schedule
│   │   ├── Power quality trending
│   │   └── AI/ML predictive maintenance (if deployed)
│   ├── D4.4 Generator Maintenance
│   │   ├── Weekly no-load test procedure
│   │   ├── Monthly 30% load test (NFPA 110)
│   │   ├── Annual 2-hour full-load test
│   │   ├── Oil and filter change procedure
│   │   ├── Coolant system service
│   │   ├── Fuel system service (filters, injectors)
│   │   └── ATS/STS maintenance and testing
│   └── D4.5 UPS/Battery Maintenance
│       ├── Monthly battery inspection
│       ├── Quarterly capacity test
│       ├── Annual full discharge test
│       ├── Battery replacement procedure
│       ├── UPS module replacement procedure
│       └── UPS firmware update procedure
│
├── D5. Environmental Health & Safety (20-25 SOPs)
│   ├── D5.1 Arc flash safety procedure
│   ├── D5.2 Lock-out / tag-out (LOTO) procedure
│   ├── D5.3 Confined space entry procedure
│   ├── D5.4 Working at height procedure
│   ├── D5.5 Hot work permit procedure
│   ├── D5.6 Chemical handling procedure (diesel, refrigerant, cleaning agents)
│   ├── D5.7 Personal protective equipment (PPE) requirements
│   ├── D5.8 Safety induction for visitors and contractors
│   ├── D5.9 Incident investigation procedure
│   ├── D5.10 Near-miss reporting procedure
│   ├── D5.11 Safety toolbox meeting procedure
│   ├── D5.12 First aid procedure
│   ├── D5.13 Fire warden duties
│   ├── D5.14 Evacuation drill procedure (minimum 2x per year)
│   └── D5.15 Environmental monitoring (noise, air quality, vibration)
│
└── D6. Access & Customer Service (15-20 SOPs)
    ├── D6.1 Customer access procedure (24/7)
    ├── D6.2 Visitor access procedure
    ├── D6.3 Contractor access procedure
    ├── D6.4 Emergency access procedure (after-hours)
    ├── D6.5 Delivery and shipping/receiving procedure
    ├── D6.6 Equipment move-in/move-out procedure
    ├── D6.7 Remote hands service procedure
    ├── D6.8 Cross-connect installation procedure
    ├── D6.9 Customer orientation/training procedure
    ├── D6.10 Customer complaint handling procedure
    ├── D6.11 SLA reporting to customer procedure
    └── D6.12 Customer communication (planned maintenance, incidents)
```

---

### 3.6 Category E: Spare Parts & Inventory

> Minimum spare parts on-site before RFS. Sized based on: equipment criticality, lead time, MTBF data, OEM recommendations, and tier requirements.

```
E. SPARE PARTS & INVENTORY
├── E1. Electrical Spares
│   ├── E1.1 UPS batteries (minimum 1 string per UPS + 10% of total)
│   ├── E1.2 UPS power modules (1 per UPS frame minimum)
│   ├── E1.3 UPS control boards (1 per UPS type)
│   ├── E1.4 UPS capacitors (set per UPS type)
│   ├── E1.5 Circuit breakers (1 of each rating — MV and LV)
│   ├── E1.6 Fuses (10% stock of each type)
│   ├── E1.7 ATS/STS actuator mechanism (1 per type)
│   ├── E1.8 PDU modules (1 per type)
│   ├── E1.9 Generator starter motor (1 per generator type)
│   ├── E1.10 Generator alternator voltage regulator (1 per type)
│   ├── E1.11 Generator fuel injectors (set per engine type)
│   ├── E1.12 Generator filters (oil, fuel, air — 2 sets per generator)
│   ├── E1.13 Generator belts (2 sets per generator)
│   ├── E1.14 Generator coolant (reserve sufficient for 1 full change)
│   ├── E1.15 Generator lubricating oil (reserve for 1 full change + top-ups)
│   ├── E1.16 Busway tap-off boxes (2 spares)
│   ├── E1.17 Power cables and lugs (assorted)
│   └── E1.18 Electrical contactors and relays (2 per type)
│
├── E2. Mechanical/Cooling Spares
│   ├── E2.1 CRAH/CRAC fans and motors (1 per unit type)
│   ├── E2.2 CRAH/CRAC belts (2 sets per unit)
│   ├── E2.3 CRAH/CRAC filters (1 full replacement set)
│   ├── E2.4 Chiller compressor (sourced under OEM contract — not on-site for large units)
│   ├── E2.5 Chiller oil charge (1 set)
│   ├── E2.6 Refrigerant (sufficient for 1 full system charge per circuit)
│   ├── E2.7 Cooling tower fan motor (1 per tower)
│   ├── E2.8 Cooling tower fill media (10% replacement stock)
│   ├── E2.9 Pump mechanical seals (2 per pump type)
│   ├── E2.10 Pump impeller (1 per pump type — for critical pumps)
│   ├── E2.11 Valve actuators (2 per type)
│   ├── E2.12 Pressure and temperature sensors (5% stock)
│   ├── E2.13 Water treatment chemicals (3 months supply)
│   ├── E2.14 CDU components — quick-connect couplings, hoses (for DLC systems)
│   ├── E2.15 CDU coolant (sufficient for 1 full circuit)
│   └── E2.16 Pipe fittings and gaskets (assorted)
│
├── E3. Fire Protection Spares
│   ├── E3.1 Clean agent reserve (1 full discharge quantity — NFPA required)
│   ├── E3.2 VESDA sampling tubes (10% stock)
│   ├── E3.3 VESDA filters (1 replacement set)
│   ├── E3.4 Smoke detectors (5% stock)
│   ├── E3.5 Heat detectors (5% stock)
│   ├── E3.6 Sprinkler heads (5% stock, minimum 6 per NFPA 13)
│   ├── E3.7 Fire alarm modules (2 per type)
│   └── E3.8 Fire extinguishers (1 spare per type per floor)
│
├── E4. BMS/DCIM Spares
│   ├── E4.1 BMS controllers (1 per controller type)
│   ├── E4.2 BMS I/O modules (2 per type)
│   ├── E4.3 Temperature sensors (10% stock)
│   ├── E4.4 Humidity sensors (10% stock)
│   ├── E4.5 Differential pressure sensors (5% stock)
│   ├── E4.6 Leak detection rope/cable (10% stock)
│   ├── E4.7 EPMS meters (2 per type)
│   └── E4.8 Network switches for BMS (1 spare)
│
├── E5. Security Spares
│   ├── E5.1 Card readers (2 per type)
│   ├── E5.2 Biometric scanners (1 per type)
│   ├── E5.3 CCTV cameras (5% stock, minimum 2)
│   ├── E5.4 CCTV hard drives (1 per NVR)
│   ├── E5.5 Door contacts (5% stock)
│   ├── E5.6 Motion detectors (5% stock)
│   └── E5.7 UPS for security systems (1 battery set)
│
├── E6. Network/ICT Spares
│   ├── E6.1 Fiber optic patch cords (5% stock, assorted types)
│   ├── E6.2 Copper patch cords (5% stock)
│   ├── E6.3 SFP/QSFP optics (5% stock per type)
│   ├── E6.4 Network switch (1 per type)
│   ├── E6.5 Fiber splice kits (2)
│   └── E6.6 Cable management accessories (assorted)
│
└── E7. General & Consumables
    ├── E7.1 Light bulbs/tubes (10% stock)
    ├── E7.2 Air filters — general HVAC (1 full set)
    ├── E7.3 Cleaning supplies (3 months stock)
    ├── E7.4 PPE stock (hard hats, safety glasses, gloves, ear protection)
    ├── E7.5 Signage and labels (assorted)
    ├── E7.6 Sealants, lubricants, and adhesives
    └── E7.7 Padlocks and LOTO equipment
```

**Spare Parts Budget**: Typically 1.5-3% of total MEP CAPEX for initial stocking, then 0.5-1.5% annually for replenishment.

---

### 3.7 Category F: Maintenance Contracts

```
F. MAINTENANCE CONTRACTS (Must be signed before RFS)
├── F1. UPS System Maintenance
│   ├── Provider: OEM (Schneider/Vertiv/Eaton) or authorized third-party
│   ├── Scope: PM visits (2-4x/year), battery testing, emergency call-out
│   ├── SLA: 4h response / 24h resolution (P1), 8h / 48h (P2)
│   ├── Parts coverage: Full or parts-only options
│   └── Contract term: Typically 3-5 years
│
├── F2. Generator Maintenance
│   ├── Provider: OEM (Caterpillar/Cummins/MTU) or authorized dealer
│   ├── Scope: PM per NFPA 110, oil/filter service, load bank testing
│   ├── SLA: 4h response for emergency, 24h for scheduled
│   ├── Includes: ATS/STS maintenance
│   └── Contract term: 3-5 years
│
├── F3. Chiller/Cooling System Maintenance
│   ├── Provider: OEM (Carrier/Trane/Daikin) or certified contractor
│   ├── Scope: Semi-annual PM, refrigerant management, oil analysis
│   ├── SLA: 4h response / 24h resolution
│   ├── Includes: Cooling towers, pumps, piping, water treatment
│   └── Contract term: 3-5 years
│
├── F4. Fire Suppression System
│   ├── Provider: Certified fire protection contractor
│   ├── Scope: Annual inspection per NFPA, agent level check, room integrity test
│   ├── SLA: 4h response for alarm system faults
│   ├── Includes: VESDA, clean agent, sprinklers, FACP, EPO
│   └── Contract term: Annual renewal
│
├── F5. BMS/DCIM Support
│   ├── Provider: System integrator or OEM
│   ├── Scope: Software updates, sensor calibration, alarm management
│   ├── SLA: 4h response / 24h resolution
│   ├── Includes: EPMS, environmental monitoring, dashboard support
│   └── Contract term: Annual with auto-renewal
│
├── F6. Electrical Infrastructure
│   ├── Provider: NETA-certified testing firm
│   ├── Scope: Annual thermographic survey, power quality analysis, PM
│   ├── SLA: Scheduled visits + emergency call-out
│   ├── Includes: MV/LV switchgear, transformers, busway, PDUs
│   └── Contract term: Annual
│
├── F7. Security Systems
│   ├── Provider: Security integrator
│   ├── Scope: Quarterly PM, CCTV health check, access control updates
│   ├── SLA: 4h response for access system faults
│   └── Contract term: Annual
│
├── F8. Elevator/Lift Maintenance
│   ├── Provider: OEM (Otis/Schindler/Kone)
│   ├── Scope: Monthly PM, safety inspection
│   ├── SLA: 24h response
│   └── Contract term: Annual (regulatory requirement)
│
├── F9. Pest Control
│   ├── Provider: Licensed pest control company
│   ├── Scope: Monthly inspection and treatment
│   └── Contract term: Annual
│
├── F10. Professional Cleaning
│   ├── Provider: Data center certified cleaning company
│   ├── Scope: White space cleaning (sub-floor, above ceiling), office cleaning
│   ├── Frequency: Monthly (white space), daily (offices/common areas)
│   └── Contract term: Annual
│
├── F11. Waste Management
│   ├── Provider: Licensed waste contractor
│   ├── Scope: General waste, recycling, hazardous waste (batteries, refrigerant, oil)
│   ├── Frequency: Weekly general, as-needed hazardous
│   └── Contract term: Annual
│
└── F12. Landscaping & Grounds
    ├── Provider: Landscaping company
    ├── Scope: Grounds maintenance, vegetation management near equipment
    └── Contract term: Annual
```

---

### 3.8 Category G: Fuel & Energy Contracts

```
G. FUEL & ENERGY CONTRACTS
├── G1. Diesel Fuel Supply
│   ├── G1.1 Primary fuel supplier contract
│   │   ├── Guaranteed delivery within 4-8 hours of order
│   │   ├── 24/7 emergency delivery capability
│   │   ├── Fuel quality per ASTM D975
│   │   ├── Price mechanism (fixed/index-linked)
│   │   └── Minimum order quantity and frequency
│   ├── G1.2 Secondary/backup fuel supplier contract
│   │   ├── Different supplier from primary (supply chain diversity)
│   │   ├── Same delivery time guarantees
│   │   └── Activated if primary fails to deliver
│   ├── G1.3 Emergency fuel delivery agreement
│   │   ├── Guaranteed delivery within 2-4 hours
│   │   ├── 24/7/365 availability
│   │   └── Pre-positioned fuel at regional depots
│   └── G1.4 Fuel management
│       ├── Fuel polishing schedule (every 6-12 months)
│       ├── Fuel quality testing (ASTM D975, annual minimum)
│       ├── Microbial growth testing
│       ├── Water content testing
│       └── Fuel additive program
│
├── G2. Minimum Fuel Levels at RFS
│   ├── G2.1 Main storage tank: Filled to 90% capacity minimum
│   ├── G2.2 Day tank(s): Filled to 90% capacity minimum
│   ├── G2.3 NFPA 110 Level 1: Tank sized at 133% of 96-hour requirement
│   │   └── Formula: Tank size = (consumption rate gal/hr × 96 hours × 1.33)
│   ├── G2.4 Uptime Institute: Minimum 12 hours at N capacity (regardless of Tier)
│   ├── G2.5 TIA-942: 80% of each generator's running capacity
│   ├── G2.6 Cloud company-specific requirements:
│   │   ├── Google: Not disclosed (NDA)
│   │   ├── Microsoft: Diesel-free by 2030 target → HVO/renewable fuel
│   │   ├── AWS: Standard 48-72 hours
│   │   ├── Meta: Standard 48-72 hours
│   │   └── Equinix/Colo: Typically 48-72 hours + resupply contract
│   └── G2.7 Practical recommendation: 72-hour minimum at full N load
│
├── G3. Fuel Storage Infrastructure
│   ├── G3.1 Bulk tank certification (API 650/UL 142)
│   ├── G3.2 Day tank certification
│   ├── G3.3 Fuel transfer system tested and operational
│   ├── G3.4 Secondary containment (110% of largest tank)
│   ├── G3.5 Leak detection system operational
│   ├── G3.6 Low fuel annunciation — at generator panel AND remote
│   ├── G3.7 Fuel fill point access for delivery trucks
│   └── G3.8 Indoor tank limitation: ≤660 gallons per NFPA
│
├── G4. Electricity Supply
│   ├── G4.1 Utility Power Purchase Agreement (PPA) signed
│   ├── G4.2 Grid connection agreement executed
│   ├── G4.3 Renewable energy PPA (if applicable)
│   ├── G4.4 Renewable Energy Certificates (RECs) procurement
│   ├── G4.5 On-site generation agreement (if solar/BESS)
│   ├── G4.6 Power factor correction agreement
│   └── G4.7 Utility metering accuracy verified
│
└── G5. Water Supply
    ├── G5.1 Municipal water supply agreement
    ├── G5.2 Water quality testing (initial)
    ├── G5.3 Water treatment chemical supply contract
    ├── G5.4 Backup water supply (if applicable)
    └── G5.5 Water discharge agreement
```

---

### 3.9 Category H: Insurance & Risk

```
H. INSURANCE & RISK
├── H1. Property Insurance
│   ├── Coverage: Full replacement value of building + infrastructure + equipment
│   ├── Typical: $50M-$5B depending on facility size
│   ├── Perils: Fire, flood, earthquake, wind, vandalism, equipment breakdown
│   ├── Exclusions to negotiate: Power failure, data loss, terrorism
│   └── Provider: Specialist data center insurer (Aon, Marsh, Willis)
│
├── H2. Business Interruption (BI) Insurance
│   ├── Coverage: Lost revenue + increased operating expenses during downtime
│   ├── Typical: 12-24 months indemnity period
│   ├── Sublimit: Often sub-limited for specific perils
│   ├── Contingent BI: For third-party facility damage
│   └── Waiting period: Typically 12-48 hours
│
├── H3. Cyber Liability Insurance
│   ├── Coverage: Data breach, ransomware, system failure, privacy liability
│   ├── Typical: $5M-$400M limits
│   ├── Includes: First-party (own losses) + third-party (customer claims)
│   └── Note: Review exclusions carefully — non-standard forms
│
├── H4. General Liability
│   ├── Coverage: Bodily injury, property damage to third parties
│   ├── Typical: $1M per occurrence / $2M aggregate minimum
│   ├── Includes: Premises liability, completed operations
│   └── Exclusion: Pollution — negotiate data center-specific exceptions
│
├── H5. Professional Liability (E&O)
│   ├── Coverage: Errors or omissions in service delivery
│   ├── Typical: $5M-$50M (colocation / managed services)
│   ├── Technology E&O: Specialized for tech companies
│   └── Often combined with cyber policy
│
├── H6. Equipment Breakdown / Electronic Data Processing (EDP)
│   ├── Coverage: Mechanical/electrical failure of equipment
│   ├── Includes: Repair/replacement cost, lost income from breakdown
│   ├── Key: Covers internal failures NOT caused by external perils
│   └── EDP extension: Covers data loss/corruption from covered events
│
└── H7. Transition & Construction
    ├── H7.1 Builder's risk → property insurance transition (seamless, no gap)
    ├── H7.2 Delay in Start-Up (DSU) coverage during commissioning
    ├── H7.3 Professional indemnity for design consultants
    └── H7.4 Contractor's all-risk during defects liability period
```

**Typical premiums**: $10,000-$50,000/year for mid-sized DCs; hyperscale programs can reach $2-3B in limits across dozens of carriers. Hyperscale campuses exceeding $20B total insured value face a market cap of ~$5B per single asset.

---

### 3.10 Category I: Staffing & Training

```
I. STAFFING & TRAINING
├── I1. Operations Team (Hired & Trained Before RFS)
│   ├── I1.1 Facility/Operations Manager (1)
│   ├── I1.2 Shift Leads / Duty Managers (4-5 for 24/7 coverage)
│   ├── I1.3 Electrical Engineers / Technicians
│   ├── I1.4 Mechanical Engineers / Technicians
│   ├── I1.5 BMS/DCIM Operators
│   ├── I1.6 IT/Network Engineers (if managed services)
│   ├── I1.7 Administrative Support
│   └── I1.8 Staffing ratio:
│       ├── Enterprise (1-5 MW): 25-45 total FTE
│       ├── Colocation (5-20 MW): 30-60 total FTE
│       ├── Hyperscale (20-100 MW): 50-100 total FTE
│       └── AI/HPC (100+ MW): 80-200 total FTE
│
├── I2. Security Team
│   ├── I2.1 Security Manager
│   ├── I2.2 Security Officers (24/7 coverage — minimum 5 for rotation)
│   ├── I2.3 Reception/visitor management
│   └── I2.4 Security SOC operator (if 24/7 monitoring center)
│
├── I3. Training Completions Required Before RFS
│   ├── I3.1 System-specific training from OEMs
│   │   ├── UPS operation and emergency procedures
│   │   ├── Generator operation and emergency procedures
│   │   ├── Chiller plant operation
│   │   ├── Fire suppression system operation
│   │   ├── BMS/DCIM operation
│   │   ├── EPMS operation
│   │   └── Security system operation
│   ├── I3.2 Safety training
│   │   ├── Arc flash awareness and PPE
│   │   ├── Lock-out/tag-out (LOTO)
│   │   ├── Confined space entry
│   │   ├── Working at height
│   │   ├── Chemical handling (diesel, refrigerant, battery acid)
│   │   ├── Fire warden training
│   │   ├── First aid / CPR / AED
│   │   └── Emergency evacuation drill
│   ├── I3.3 Operational certifications
│   │   ├── BNSP operator certification (Indonesia)
│   │   ├── K3 Listrik certification (Indonesia)
│   │   ├── NFPA 70E electrical safety
│   │   ├── Refrigerant handling certification (EPA 608 or equivalent)
│   │   └── CDL / forklift license (if applicable)
│   └── I3.4 Competency assessments
│       ├── Written examinations
│       ├── Practical demonstrations
│       └── Emergency scenario simulations
│
├── I4. On-Call Roster
│   ├── I4.1 24/7 on-call roster established
│   ├── I4.2 Escalation chain defined (P1→Manager→VP→CTO)
│   ├── I4.3 On-call communication tested (phone, SMS, app)
│   └── I4.4 On-call response time: <30 min for P1, <1h for P2
│
├── I5. Third-Party Support Contacts
│   ├── I5.1 OEM 24/7 emergency hotlines tested
│   ├── I5.2 Utility provider emergency contact verified
│   ├── I5.3 Fire department liaison established
│   ├── I5.4 Local emergency services contacts verified
│   └── I5.5 Insurance company claims contact verified
│
└── I6. Knowledge Management
    ├── I6.1 Runbook / playbook compiled (all emergency and normal procedures)
    ├── I6.2 NOC/SOC dashboards operational
    ├── I6.3 Ticketing system operational (ServiceNow, Jira, etc.)
    ├── I6.4 CMMS populated with all assets and PM schedules
    └── I6.5 Knowledge base / wiki established
```

---

### 3.11 Category J: Customer/Tenant & Commercial Readiness

```
J. CUSTOMER/TENANT & COMMERCIAL READINESS
├── J1. Master Service Agreement (MSA)
│   ├── J1.1 MSA signed with customer(s)
│   ├── J1.2 Service Level Agreement (SLA) defined
│   │   ├── Power availability: 99.99% (Tier III) / 99.999% (Tier IV)
│   │   ├── Power quality: Voltage ±5%, Frequency ±0.5 Hz, THD <5%
│   │   ├── Temperature: 18-27°C (ASHRAE A1), ±1°C control
│   │   ├── Humidity: 20-80% RH, ±5% control
│   │   ├── Network availability: 99.99%+
│   │   ├── Security response: <5 min on-site
│   │   ├── Support response: P1=15min, P2=1h, P3=4h, P4=NBD
│   │   ├── Remote hands response: <1 hour
│   │   └── Planned maintenance windows: Defined (e.g., Sun 02:00-06:00)
│   ├── J1.3 SLA credit structure
│   │   ├── Tier-based credits (5% MRC per 60 min downtime, up to 50%)
│   │   ├── Measurement methodology (availability formula)
│   │   ├── Reporting frequency (monthly)
│   │   └── Credit claim process
│   ├── J1.4 Contract commercial terms
│   │   ├── Pricing structure ($/kW/month or $/sqft/month)
│   │   ├── Power metering methodology
│   │   ├── Rate escalation mechanism (CPI, fixed %, index-linked)
│   │   ├── Payment terms (Net 30/45/60)
│   │   ├── Security deposit / letter of credit
│   │   ├── Contract term and renewal options
│   │   └── Early termination clauses and fees
│   └── J1.5 Legal clauses
│       ├── Force majeure definition
│       ├── Liability caps
│       ├── Indemnification
│       ├── Data sovereignty / privacy (GDPR, local laws)
│       └── Insurance requirements from customer
│
├── J2. Physical Space Readiness
│   ├── J2.1 Customer cage/suite buildout complete
│   ├── J2.2 Rack installation complete (if provided)
│   ├── J2.3 Power whips/cables to customer space installed
│   ├── J2.4 A+B power feed verified and tested
│   ├── J2.5 Cooling verified to customer space
│   ├── J2.6 Fire suppression coverage verified in customer space
│   ├── J2.7 Cable management installed
│   └── J2.8 Customer space cleaning completed
│
├── J3. Network & Connectivity
│   ├── J3.1 Cross-connects installed and tested
│   ├── J3.2 Meet-me room access provisioned
│   ├── J3.3 Internet transit/bandwidth provisioned
│   ├── J3.4 Carrier connections active
│   ├── J3.5 Network diversity verification
│   └── J3.6 DNS/NTP/DHCP verified (if managed)
│
├── J4. Access & Credentials
│   ├── J4.1 Customer physical access credentials issued
│   ├── J4.2 Customer portal access provisioned (DCIM, ticketing, billing)
│   ├── J4.3 Emergency contact list exchanged
│   ├── J4.4 Authorized personnel list received from customer
│   └── J4.5 Access control zones configured per customer
│
├── J5. Customer Acceptance
│   ├── J5.1 Customer walkthrough / site inspection
│   ├── J5.2 Customer acceptance test (power, cooling, network)
│   ├── J5.3 Burn-in period (typically 7-30 days)
│   ├── J5.4 Customer sign-off / acceptance certificate
│   └── J5.5 RFS date formally confirmed
│
├── J6. Commercial Systems
│   ├── J6.1 Billing system configured
│   ├── J6.2 Power metering verified and calibrated
│   ├── J6.3 Invoice template approved by customer
│   ├── J6.4 Payment processing setup
│   └── J6.5 Reconciliation process agreed
│
├── J7. Hyperscale-Specific (if applicable)
│   ├── J7.1 Shell & core readiness verification
│   ├── J7.2 White space readiness per design spec
│   ├── J7.3 Phased delivery milestones met
│   ├── J7.4 Performance acceptance criteria demonstrated
│   ├── J7.5 Liquidated damages settlement (if late)
│   ├── J7.6 Capacity ramp schedule agreed
│   └── J7.7 Hold points and inspection rights exercised
│
└── J8. Reporting & Communication
    ├── J8.1 Monthly SLA report template agreed
    ├── J8.2 Incident notification procedure agreed
    ├── J8.3 Maintenance notification procedure agreed (7-day advance)
    ├── J8.4 Customer communication channel established (email, portal, phone)
    └── J8.5 Quarterly business review (QBR) schedule set
```

---

## 4. Cost Model & Algorithms

### 4.1 Total RFS Cost Composition

```
Total RFS Cost = Technical Commissioning Cost
               + Documentation & Handover Cost
               + Certification & Permitting Cost
               + SOP Development Cost
               + Spare Parts Initial Stock Cost
               + Maintenance Contract Setup Cost
               + Fuel Initial Fill + Contract Setup Cost
               + Insurance Premium (First Year)
               + Staffing Recruitment & Training Cost
               + Customer Readiness Cost
               + Contingency
```

### 4.2 Technical Commissioning Cost Algorithm

```javascript
function calcCommissioningCost(inputs) {
  const itLoadMW = inputs.itLoad / 1000;

  // Base construction cost (from CAPEX calculator or manual input)
  const constructionCost = inputs.constructionCost || (itLoadMW * getCostPerMW(inputs));

  // CxA fee
  const cxaFeeRate = getCxaFeeRate(inputs.facilityType, inputs.tierLevel);
  // Enterprise: 2.0-3.0%, Colo: 1.5-2.5%, Hyperscale: 1.0-2.0%, Edge: 0.5-1.5%
  const cxaFee = constructionCost * (cxaFeeRate / 100);

  // System-level commissioning cost allocation
  const systemAllocation = {
    electrical: 0.40,    // 35-45% of Cx budget
    mechanical: 0.25,    // 20-30%
    fireProtection: 0.07, // 5-8%
    bmsDcim: 0.12,       // 10-15%
    security: 0.04,      // 3-5%
    networkIct: 0.07,    // 5-8%
    documentation: 0.05   // 5-10%
  };

  // Tier multiplier
  const tierMult = { 'tier1': 0.70, 'tier2': 0.85, 'tier3': 1.00, 'tier4': 1.35 };

  // DLC/liquid cooling premium
  const dlcPremium = 1.0 + (inputs.dlcPercent / 100) * 0.25; // Up to 25% premium at 100% DLC

  // Cloud company multiplier
  const cloudMult = CLOUD_PROFILES[inputs.cloudProfile].costMultiplier;

  // Testing rigor multiplier
  const rigorMult = { standard: 1.0, enhanced: 1.15, maximum: 1.30 };

  // Equipment rental costs
  const equipmentCost = calcEquipmentRental(itLoadMW, inputs.soakTestDuration);

  // Personnel costs
  const personnelCost = calcPersonnelCost(itLoadMW, inputs);

  // Total commissioning
  const baseCxCost = cxaFee * tierMult[inputs.tierLevel] * dlcPremium * cloudMult
                    * rigorMult[inputs.testingRigor];

  return {
    cxaFee,
    systemCosts: Object.fromEntries(
      Object.entries(systemAllocation).map(([k, v]) => [k, baseCxCost * v])
    ),
    equipmentCost,
    personnelCost,
    totalCommissioning: baseCxCost + equipmentCost + personnelCost
  };
}
```

### 4.3 Cost Per MW by Facility Type

```javascript
function getCostPerMW(inputs) {
  const baseCost = {
    enterprise: 12000000,   // $12M/MW
    colo: 10000000,         // $10M/MW
    hyperscale: 9000000,    // $9M/MW
    aiHpc: 18000000,        // $18M/MW (liquid cooling + high density)
    edge: 15000000          // $15M/MW (higher per MW at small scale)
  };

  const locationMult = {
    americas: 1.0,
    emea: 1.15,
    apac: 0.85,
    middleEast: 1.05,
    africa: 0.75
  };

  const yearEscalation = {
    2025: 1.000, 2026: 1.060, 2027: 1.115,
    2028: 1.170, 2029: 1.225, 2030: 1.280
  };

  return baseCost[inputs.facilityType]
       * locationMult[inputs.location]
       * yearEscalation[inputs.projectionYear];
}
```

### 4.4 Equipment Rental Cost Algorithm

```javascript
function calcEquipmentRental(itLoadMW, soakHours) {
  // Load bank: $300-600/day for 500-2000 kW
  const loadBankKw = itLoadMW * 1000; // Full IT load
  const loadBankDays = Math.ceil(soakHours / 24) + 7; // Soak + setup/testing
  const loadBankCostPerDay = loadBankKw <= 500 ? 300
                           : loadBankKw <= 2000 ? 500
                           : loadBankKw <= 5000 ? 1200
                           : 2500 + (loadBankKw / 1000) * 200;
  const loadBankTotal = loadBankCostPerDay * loadBankDays;

  // Power quality analyzer: $350/week
  const pqaWeeks = Math.ceil(loadBankDays / 7) + 2;
  const pqaTotal = pqaWeeks * 350;

  // Thermal imaging: $100/day
  const thermalDays = loadBankDays;
  const thermalTotal = thermalDays * 100;

  // Megger (insulation tester): $250/week
  const meggerWeeks = Math.max(4, Math.ceil(itLoadMW));
  const meggerTotal = meggerWeeks * 250;

  // DLRO (micro-ohmmeter): $200/week
  const dlroTotal = meggerWeeks * 200;

  // Vibration analyzer: $300/week
  const vibrationWeeks = Math.ceil(meggerWeeks * 0.5);
  const vibrationTotal = vibrationWeeks * 300;

  return {
    loadBank: loadBankTotal,
    powerQualityAnalyzer: pqaTotal,
    thermalImaging: thermalTotal,
    megger: meggerTotal,
    dlro: dlroTotal,
    vibrationAnalyzer: vibrationTotal,
    total: loadBankTotal + pqaTotal + thermalTotal + meggerTotal + dlroTotal + vibrationTotal
  };
}
```

### 4.5 Staffing Cost Algorithm

```javascript
function calcPersonnelCost(itLoadMW, inputs) {
  // Base staffing by role (peak during L4/L5)
  const baseStaffing = {
    cxManager: { count: 1, dayRate: 1200 },   // $1,200/day
    seniorCxEngineer: { count: 0, dayRate: 900 },
    cxEngineer: { count: 0, dayRate: 700 },
    oemTechnician: { count: 0, dayRate: 800 },
    supportStaff: { count: 0, dayRate: 400 }
  };

  // Scale by facility size
  if (itLoadMW <= 2) {
    baseStaffing.seniorCxEngineer.count = 1;
    baseStaffing.cxEngineer.count = 2;
    baseStaffing.oemTechnician.count = 3;
    baseStaffing.supportStaff.count = 1;
  } else if (itLoadMW <= 10) {
    baseStaffing.seniorCxEngineer.count = 3;
    baseStaffing.cxEngineer.count = 5;
    baseStaffing.oemTechnician.count = 8;
    baseStaffing.supportStaff.count = 3;
  } else if (itLoadMW <= 50) {
    baseStaffing.cxManager.count = 2;
    baseStaffing.seniorCxEngineer.count = 6;
    baseStaffing.cxEngineer.count = 14;
    baseStaffing.oemTechnician.count = 20;
    baseStaffing.supportStaff.count = 8;
  } else if (itLoadMW <= 100) {
    baseStaffing.cxManager.count = 3;
    baseStaffing.seniorCxEngineer.count = 10;
    baseStaffing.cxEngineer.count = 25;
    baseStaffing.oemTechnician.count = 35;
    baseStaffing.supportStaff.count = 12;
  } else { // 100+ MW mega campus
    baseStaffing.cxManager.count = 5;
    baseStaffing.seniorCxEngineer.count = 20;
    baseStaffing.cxEngineer.count = 45;
    baseStaffing.oemTechnician.count = 75;
    baseStaffing.supportStaff.count = 30;
  }

  // Location multiplier for labor costs
  const laborMult = {
    americas: 1.0, emea: 1.15, apac: 0.65, middleEast: 0.85, africa: 0.55
  };

  // Cloud company staffing multiplier
  const cloudStaffMult = CLOUD_PROFILES[inputs.cloudProfile].staffingMultiplier;

  // Duration (working days) based on timeline
  const cxDurationWeeks = calcTimelineWeeks(itLoadMW, inputs).totalOnSite;
  const cxDurationDays = cxDurationWeeks * 5; // Working days

  // Calculate total
  let totalCost = 0;
  const breakdown = {};
  for (const [role, data] of Object.entries(baseStaffing)) {
    const cost = data.count * data.dayRate * cxDurationDays
               * laborMult[inputs.location] * cloudStaffMult;
    breakdown[role] = { count: data.count, dayRate: data.dayRate, totalCost: cost };
    totalCost += cost;
  }

  return { breakdown, totalCost, totalHeadcount: Object.values(baseStaffing).reduce((s, d) => s + d.count, 0) };
}
```

---

## 5. Timeline / Gantt Chart Model

### 5.1 Phase Duration Algorithm

```javascript
function calcTimelineWeeks(itLoadMW, inputs) {
  // Base durations by facility type (weeks)
  const baseDurations = {
    enterprise: { l0: 6, l1: 3, l2: 2, l3: 4, l4: 5, l5: 2, l6: 1 },
    colo:       { l0: 8, l1: 5, l2: 3, l3: 6, l4: 8, l5: 3, l6: 2 },
    hyperscale: { l0: 12, l1: 9, l2: 6, l3: 12, l4: 12, l5: 6, l6: 3 },
    aiHpc:      { l0: 14, l1: 12, l2: 8, l3: 16, l4: 18, l5: 8, l6: 3 },
    edge:       { l0: 3, l1: 0, l2: 1, l3: 2, l4: 2, l5: 1, l6: 1 }
  };

  const base = baseDurations[inputs.facilityType];

  // Scale by IT load within type
  const sizeScale = Math.max(0.6, Math.min(1.5, 0.7 + (itLoadMW / 200)));

  // Cloud company timeline multiplier
  const cloudTimeMult = CLOUD_PROFILES[inputs.cloudProfile].timelineMultiplier;

  // Tier rigor multiplier
  const tierTimeMult = { tier1: 0.70, tier2: 0.85, tier3: 1.00, tier4: 1.25 };

  // DLC premium on timeline
  const dlcTimeMult = 1.0 + (inputs.dlcPercent / 100) * 0.15;

  // Equipment lead time factor
  const leadTimeMult = { standard: 1.0, extended: 1.15, critical: 1.30 };

  const mult = sizeScale * cloudTimeMult * tierTimeMult[inputs.tierLevel]
             * dlcTimeMult * leadTimeMult[inputs.equipLeadTime];

  const phases = {};
  let totalOnSite = 0;
  for (const [phase, weeks] of Object.entries(base)) {
    phases[phase] = Math.max(1, Math.round(weeks * mult));
    if (phase !== 'l0' && phase !== 'l1') totalOnSite += phases[phase]; // L0 & L1 overlap construction
  }

  return {
    phases,
    totalOnSite,
    totalIncludingOverlap: Object.values(phases).reduce((s, v) => s + v, 0),
    // Gantt chart data with overlaps
    gantt: buildGanttData(phases)
  };
}

function buildGanttData(phases) {
  // L0 and L1 run in parallel with construction
  // L2-L3 can have 25-40% overlap
  // L4-L5 are sequential (L5 requires all L4 punch items resolved)
  // L6 follows L5

  let week = 0;
  const bars = [];

  // L0: starts at construction start (week 0)
  bars.push({ phase: 'L0', label: 'Design & Planning', start: 0, end: phases.l0, color: '#64748b', tag: '—' });

  // L1: overlaps with construction, starts after L0 begins
  const l1Start = Math.round(phases.l0 * 0.5);
  bars.push({ phase: 'L1', label: 'Factory Testing (FAT)', start: l1Start, end: l1Start + phases.l1, color: '#ef4444', tag: 'Red' });

  // L2: starts when equipment arrives (after L1 or construction milestone)
  const l2Start = l1Start + phases.l1;
  bars.push({ phase: 'L2', label: 'Delivery & Installation', start: l2Start, end: l2Start + phases.l2, color: '#eab308', tag: 'Yellow' });

  // L3: overlaps L2 by 25%
  const l3Start = l2Start + Math.round(phases.l2 * 0.75);
  bars.push({ phase: 'L3', label: 'System Startup', start: l3Start, end: l3Start + phases.l3, color: '#22c55e', tag: 'Green' });

  // L4: overlaps L3 by 25% (different systems can be at different levels)
  const l4Start = l3Start + Math.round(phases.l3 * 0.75);
  bars.push({ phase: 'L4', label: 'Functional Testing (FPT)', start: l4Start, end: l4Start + phases.l4, color: '#3b82f6', tag: 'Blue' });

  // L5: strictly AFTER L4 (all punch items must be resolved)
  const l5Start = l4Start + phases.l4;
  bars.push({ phase: 'L5', label: 'Integrated Testing (IST)', start: l5Start, end: l5Start + phases.l5, color: '#f8fafc', tag: 'White' });

  // L6: follows L5
  const l6Start = l5Start + phases.l5;
  bars.push({ phase: 'L6', label: 'Closeout & Handover', start: l6Start, end: l6Start + phases.l6, color: '#a855f7', tag: '—' });

  // Milestones
  const milestones = [
    { week: 0, label: 'Cx Kickoff', icon: '🚀' },
    { week: l2Start, label: 'First Equipment Arrival', icon: '📦' },
    { week: l3Start, label: 'First Energization', icon: '⚡' },
    { week: l5Start, label: 'IST Start', icon: '🔬' },
    { week: l5Start + phases.l5, label: 'IST Complete', icon: '✅' },
    { week: l6Start + phases.l6, label: 'RFS', icon: '🏁' }
  ];

  return { bars, milestones, totalWeeks: l6Start + phases.l6, criticalPath: ['L3', 'L4', 'L5'] };
}
```

### 5.2 Gantt Chart Rendering (SVG for Calculator + PDF)

The Gantt chart renders as an inline SVG with:
- Horizontal bars per phase (color-coded by tag)
- Dependency arrows (L3→L4→L5→L6)
- Milestone diamonds
- Current week marker
- Critical path highlighted in bold
- Week numbers on X-axis
- Phase labels on Y-axis
- Expandable: click a phase bar to show sub-system breakdown

---

## 6. Output Panels & KPIs

### 6.1 Free Tier Panels (4 panels)

**Panel 1: RFS Summary**
| KPI | ID | Example |
|-----|----|---------|
| Total RFS Cost | `rfsKpiTotalCost` | $12.4M |
| Timeline to RFS | `rfsKpiTimeline` | 26 weeks |
| RFS Date (estimated) | `rfsKpiRfsDate` | Sep 15, 2026 |
| Readiness Score | `rfsKpiReadiness` | 0% → 100% |
| Tier Classification | `rfsKpiTier` | Tier III |
| Cloud Standard | `rfsKpiCloud` | AWS |

**Panel 2: Cost Breakdown**
- Expandable bar chart showing 10 categories (A through J)
- Each bar shows $ amount and % of total
- Click to expand sub-categories

**Panel 3: Timeline / Gantt (Simplified)**
- SVG Gantt chart showing L0-L6 phases
- Milestone markers
- Critical path highlighted
- Total duration label

**Panel 4: Checklist Progress**
- 10 category progress bars (A through J)
- Each shows: completed / total items
- Overall % complete
- Color-coded: Red (<50%), Yellow (50-80%), Green (>80%)

### 6.2 Pro Tier Panels (6 additional panels)

**Panel 5: Detailed Gantt Chart (Interactive)**
- Full SVG Gantt with sub-system breakdown
- Expand/collapse phases to show individual system timelines
- Dependency arrows
- Resource loading histogram
- Milestones and hold points
- Export to PDF capability

**Panel 6: Staffing & Resource Plan**
| KPI | ID |
|-----|-----|
| Total Headcount (Peak) | `rfsKpiHeadcount` |
| CxA Team Size | `rfsKpiCxaTeam` |
| OEM Technicians | `rfsKpiOemTech` |
| Monthly Personnel Cost | `rfsKpiMonthlyCost` |
| Total Personnel Cost | `rfsKpiTotalPersonnel` |
| Staff Utilization Chart | SVG resource histogram |

**Panel 7: Risk & Compliance Matrix**
- Risk register with probability × impact scoring
- Compliance checklist status per certification
- Cost of non-compliance estimates
- Tornado chart: sensitivity of RFS date to key risks

**Panel 8: Spare Parts & Inventory Value**
- Breakdown by system (E1-E7)
- Total initial stock cost
- Annual replenishment estimate
- Critical items highlighted

**Panel 9: Contract Status Dashboard**
- Maintenance contracts: signed/pending/not started
- Fuel contracts: status
- Insurance: status
- Utility agreements: status
- Customer contracts: status

**Panel 10: Executive RFS Brief (Narrative)**
- Auto-generated 4-paragraph assessment
- Key risks and mitigation
- Timeline confidence
- Budget confidence
- Recommended next actions

---

## 7. Free vs Pro Feature Matrix

| Feature | Free | Pro |
|---------|------|-----|
| Facility Profile inputs | ✓ | ✓ |
| Cloud Company presets | ✓ (view only) | ✓ (full auto-config) |
| Infrastructure inputs | ✓ (basic) | ✓ (all sections) |
| Commissioning scope inputs | ✗ | ✓ |
| Sustainability inputs | ✗ | ✓ |
| Cost parameter inputs | ✗ | ✓ |
| RFS Summary panel | ✓ | ✓ |
| Cost Breakdown | Top 3 only | Full expandable |
| Simplified Gantt | ✓ | ✓ |
| Checklist Progress | ✓ | ✓ |
| Detailed Interactive Gantt | ✗ | ✓ |
| Staffing & Resource Plan | ✗ | ✓ |
| Risk & Compliance Matrix | ✗ | ✓ |
| Spare Parts Inventory | ✗ | ✓ |
| Contract Status Dashboard | ✗ | ✓ |
| Executive RFS Brief | ✗ | ✓ |
| PDF Export | ✗ | ✓ |
| Scenario Comparison | ✗ | ✓ |

---

## 8. PDF Export Design

12-section PDF report via `window.open()` with inline SVG charts:

1. **Cover Page**: Title, facility details, cloud profile, date
2. **Executive Summary**: 1-page overview with key KPIs
3. **Facility Configuration**: All input parameters
4. **Cost Summary**: Breakdown table + SVG bar chart
5. **Timeline / Gantt**: SVG Gantt chart (full detail)
6. **Commissioning Plan**: L0-L6 phases with scope per system
7. **RFS Checklist**: Complete 740-item checklist (10 categories)
8. **Staffing Plan**: Team structure, costs, timeline
9. **Spare Parts Inventory**: Full inventory list with costs
10. **Contract Requirements**: All maintenance, fuel, insurance, utility contracts
11. **Risk Register**: Top risks with mitigation actions
12. **Appendix**: Testing protocols reference, standards reference, data sources

---

## 9. Data Sources & References

### Industry Standards
- ASHRAE Guideline 0-2019: Commissioning Process for Buildings
- ASHRAE GPC-1.6: Data Center-Specific Commissioning
- ANSI/NETA ATS-2025: Acceptance Testing Specifications
- NFPA 110: Emergency and Standby Power Systems
- NFPA 75/76: Fire Protection of IT/Telecom Facilities
- NFPA 30: Flammable and Combustible Liquids Code
- Uptime Institute: Tier Classification (TCDD/TCCF/TCOS)
- TIA-942-B: Telecommunications Infrastructure Standard for Data Centers
- EN 50600: Information Technology — Data Centre Facilities
- ANSI/BICSI 002: Data Center Design and Implementation
- ISO 27001 / 14001 / 45001 / 50001
- IEEE C57.12 (Transformers), IEEE C37 (Switchgear)

### Hyperscaler Sources
- Google: Environmental Reports 2024, OCP Summit presentations, Project Deschutes/Mt. Diablo
- Microsoft: Sustainability Report 2024, Compass tool documentation, Fairwater design papers
- AWS: Project Rainier press releases, ORR documentation, ACx job descriptions
- Meta: OCP specifications (Open Rack V3.1, HPR), sustainability reports
- Oracle: Stargate press releases, earnings calls, distributed cloud documentation
- Apple: Environmental Progress Reports, LEED certifications
- OpenAI/Stargate: Construction progress reports, Abilene TX documentation
- xAI: Colossus build timeline documentation, Memphis facility permits
- NVIDIA: DGX SuperPOD reference architecture, GB200 NVL72 specifications

### Cost & Timeline Benchmarks
- Dgtl Infra: Data Center Construction Costs (2024-2026)
- Turner & Townsend: Data Centre Cost Index
- Cushman & Wakefield: Global Data Centre Market Comparison
- JLL: Data Centre Outlook reports
- CxPlanner: Commissioning cost benchmarks
- Salute: STEP playbook (175+ SOPs)

### Insurance & Commercial
- Aon: Data Centre Lifecycle Product (DCLP) specifications
- Covington & Burling: DC insurance coverage analysis (2025)
- Morgan Lewis: AI DC insurance considerations (2025)
- Reed Smith: DC unique insurance risks analysis

---

*Document Version: 1.0*
*Date: 2026-03-18*
*Author: ResistanceZero Engineering*
*Status: DRAFT — Pending Review*
