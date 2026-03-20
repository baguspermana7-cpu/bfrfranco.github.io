# Data Center Commissioning Research
## Comprehensive Reference for DC Commissioning Calculator Tool
### Research Date: 2026-03-18

---

## Table of Contents

1. [Commissioning Phases (L0-L6)](#1-commissioning-phases-l0-l6)
2. [Hyperscaler Commissioning Approaches](#2-hyperscaler-commissioning-approaches)
3. [RFS Timelines by DC Type](#3-rfs-timelines-by-dc-type)
4. [Commissioning Cost Benchmarks](#4-commissioning-cost-benchmarks)
5. [Key Deliverables Per Phase](#5-key-deliverables-per-phase)
6. [Systems to Commission](#6-systems-to-commission)
7. [Standards & Codes](#7-standards--codes)
8. [Gantt Chart Structure](#8-gantt-chart-structure)
9. [Testing Protocols](#9-testing-protocols)
10. [Common Failures & Risks](#10-common-failures--risks)

---

## 1. Commissioning Phases (L0-L6)

The industry uses a structured, gated commissioning framework with color-coded tags. While the core is L1-L5, best practice extends to L0 (Design/Planning) and L6 (Closeout/Handover).

### L0: Design & Planning (No Tag)
- **Manager:** Owner's Commissioning Consultant + General Contractor
- **Purpose:** Foundation for all subsequent commissioning activities
- **Activities:**
  - Assemble commissioning team
  - Develop and review design package
  - Define commissioning standards and processes
  - Create Owner's Project Requirements (OPR)
  - Develop Basis of Design (BOD)
  - Agree Sequence of Operation (SOO) list
  - Create BMS graphic documents and points list
  - Create Fire Cause & Effect matrix
  - Plan factory and field testing procedures
  - Design review for testability, safe energization pathways, installation sequencing
- **Deliverables:** Commissioning Plan, OPR, BOD, SOO, BMS Points List, Fire Cause & Effect Matrix, Commissioning Strategies

### L1: Factory Witness Testing / FAT (Red Tag)
- **Manager:** General Contractor + Equipment Vendors
- **Purpose:** Verify equipment meets design specifications before shipping
- **Activities:**
  - Factory testing of all critical components
  - Inspect conformity to design and drawing specifications
  - Verify contractual obligations and compliance
  - Test equipment functionality (control systems, components, interlocks)
  - Verify instrument calibration and accuracy
  - Test software and hardware functionality (I/O verification, control panel operation)
  - QA/QC checks
- **Deliverables:** Factory Test Reports, Red Tags, Confirmation to Ship Certificates, Level Close-Out Reports
- **Key Benefit:** Identifies equipment issues BEFORE shipping, avoiding significant on-site costs
- **Timeline:** Runs in parallel with construction (weeks to months per equipment set)

### L2: Delivery, Installation & Pre-Start-Up (Yellow Tag)
- **Manager:** General Contractor
- **Purpose:** Verify equipment received undamaged, properly installed, ready for energization
- **Activities:**
  - Delivery inspection and damage verification
  - Verify compliance with specifications and nameplate data
  - Physical installation verification (clearances, labeling, torque values, bonding, cable routing)
  - Electrical checks: insulation resistance (megger), contact resistance (ductor), phase rotation, CT polarity, breaker setting verification
  - Mechanical checks: pipework integrity, leak testing, sensor placement, damper actuation
  - Pre-start-up / energization inspections
  - Static testing (pressure tests, earthing tests)
  - Gather factory documentation and test certificates
- **Deliverables:** Installation Checklists, Pre-Start-Up Inspections, Yellow Tags, Level Close-Out Reports
- **Timeline:** Days to weeks per equipment batch

### L3: Pre-Functional Testing / System Start-Up (Green Tag)
- **Manager:** General Contractor (with CxA involvement)
- **Purpose:** Verify individual systems are independently functional
- **Activities:**
  - Energize systems and input validated settings
  - First-time equipment start-up
  - Standalone testing of individual systems/subsystems:
    - HVAC, fire alarms, lighting, security systems
    - Individual electrical equipment
    - Individual mechanical equipment
  - Point-to-point verifications
  - Verify valves and dampers operate correctly
  - Confirm sensor calibration
  - Document all activities and close issues
- **Deliverables:** Daily Commissioning Updates, O&M Manuals, Green Tags, Level Close-Out Reports
- **Timeline:** 2-6 weeks

### L4: Functional Performance Testing / FPT (Blue Tag)
- **Manager:** Owner's Commissioning Consultant (with GC support)
- **Purpose:** Validate each system performs as intended under various conditions
- **Activities:**
  - Comprehensive performance testing per predefined criteria
  - Test under part-load, full-load, and failure scenarios
  - Verify interlocks between equipment and systems
  - Evaluate sequence of operations
  - Test control sequences and redundancy features
  - Check each control loop, compare actual vs. designed SOO
  - Chiller load testing
  - Electrical infrastructure performance testing
  - UPS functional validation
  - Heat load testing
  - Staff training
  - Setpoint adjustments as necessary
- **Deliverables:** Test Data Downloads, Daily Coordination Workshop Minutes, Daily Updates, Final O&M Manuals, Blue Tags, Level Close-Out Reports
- **Timeline:** 2-6 weeks

### L5: Integrated System Testing / IST (White Tag)
- **Manager:** Owner's Commissioning Consultant / CxA
- **Purpose:** Verify ALL systems interact seamlessly as an integrated facility
- **Activities:**
  - Verify completion of L1-L4 and resolution of all punch-list items
  - Develop detailed IST procedures with scenarios, expected outcomes, acceptance criteria
  - Building-wide response testing for major events:
    - Total Power Outage Test (TOAT) / Blackout Test
    - Utility power failure simulation
    - Generator start and transfer
    - UPS transfer scenarios
    - Multiple simultaneous failures
    - Fire alarm integration
    - Cooling system response to power events
    - BMS/EPMS alarm propagation
  - Integrated System Acceptance Testing (ISAT):
    - Integrated performance testing
    - Redundancy testing
    - Total Power Outage Test
  - Systems operated at various loads and modes
  - Data capture with timestamps across power, cooling, controls
  - Verify cause-and-effect relationships
- **Deliverables:** IST Reports, Commissioning Focused Reports, White Tags, Data Analysis, Level Close-Out Reports
- **Timeline:** 1-4 weeks (up to 20+ working days for complex facilities)

### L6: Closeout / Turnover / Handover (No Tag)
- **Manager:** CxA + Owner's Representatives
- **Purpose:** Complete documentation and formal facility handover
- **Activities:**
  - Write and issue closeout script
  - Complete clean of data halls and critical areas
  - Final site inspection
  - Inspect and document all plant settings
  - Lessons Learned workshop
  - Closeout meeting
  - Compile turnover documentation package
- **Deliverables:** Final Commissioning Report, Systems Manual, Complete O&M Manuals, As-Built Records, Test Certificates, Lessons Learned Document

### Color Tag Summary

| Level | Name | Tag Color | Key Focus |
|-------|------|-----------|-----------|
| L0 | Design & Planning | — | Foundation & documentation |
| L1 | Factory Witness Testing | Red | Equipment verification at factory |
| L2 | Delivery & Pre-Installation | Yellow | Installation verification |
| L3 | Pre-Functional / Start-Up | Green | Individual system testing |
| L4 | Functional Performance Testing | Blue | System performance under conditions |
| L5 | Integrated System Testing | White | All systems working together |
| L6 | Closeout / Handover | — | Documentation & turnover |

---

## 2. Hyperscaler Commissioning Approaches

### AWS (Amazon Web Services)
- **Scale:** 105 data centers in the US, 2.3 GW live IT capacity (2025), 241 known locations across 22 countries, 83 sites under construction
- **Strategy:** Massive parallel buildout, regional diversity
- **Example:** Project Rainier - $8B, 30 interconnected data centers in Indiana, each ~200,000 sq ft, housing Trainium 2 servers (completed 2025)
- **Typical Timeline:** 18-24 months per facility (estimated from patterns)
- **2026 CAPEX:** ~$200 billion projected

### Google Cloud Platform
- **Scale:** 22 US data centers, 508 MW active IT capacity (2025), 42 regions globally
- **Strategy:** Modular data center approach (cuts construction time by up to 50%), AI infrastructure + carbon-free energy alignment
- **Testing Protocol:** 72-hour full-load test protocol, achieving 99.999% uptime
- **TPU clusters:** Require immense compute, expand in locations with clean stable power
- **2026 CAPEX:** ~$175-185 billion projected

### Microsoft Azure
- **Scale:** 70+ regions, 400+ data centers globally
- **Strategy:** Regional diversity, carbon-negative goals, modular construction for rapid deployment
- **Custom Hardware:** Azure Maia 100 AI accelerators, Cobalt 100 CPUs, 120,000 miles dedicated fiber
- **Constraint:** $80B backlog of unfulfillable Azure orders due to power constraints
- **2026 CAPEX:** ~$120 billion+ projected

### Meta (Facebook)
- **Scale:** Planning 10+ GW total capacity by end of 2026
- **Strategy:** Precision, parallel workflows, hyper-efficient scheduling, phased delivery
- **Example:** Richland Parish, LA - 4M+ sq ft AI Campus, 24-36 month buildout, phased delivery with some zones operational mid-2025
- **Approach:** Commission data halls + install networking + test power systems in parallel, long before entire site is complete
- **2025 CAPEX:** $70-72 billion; 2026 projections exceed $100 billion

### Oracle
- **Scale:** 147 active data centers, 64 under development (Dec 2025)
- **Strategy:** Stargate joint venture with OpenAI & SoftBank
- **Example:** Stargate Abilene TX - Phase 1 (2 buildings, 980K sq ft, 200 MW) energized first half 2025; Phase 2 (6 buildings, 4M sq ft, 1.2 GW) by mid-2026
- **2026 CAPEX:** ~$50 billion target

### xAI (Elon Musk)
- **Scale:** Colossus supercomputer in Memphis, ~300,000 GPUs operational, expanding to 500,000-1M GPUs
- **Facility:** 1M sq ft repurposed warehouse, 5400 Tulane Road, Memphis
- **Power:** 540 MW mobile natural gas generators + 150 MW grid
- **Speed Record:** Colossus 100,000-GPU cluster built in 122 days in shuttered Electrolux factory
- **Industry Assessment:** "The exception, not the rule" — likely spent more than typical builders would over 4 years

### OpenAI / Stargate Project
- **Joint Venture:** OpenAI + SoftBank + Oracle + MGX
- **Investment:** Up to $500 billion by 2029
- **Flagship:** Abilene, TX campus already operational on Oracle Cloud Infrastructure
- **Expansion:** 5 new US sites announced Sept 2025 (Shackelford County TX, Dona Ana County NM, Midwest, Lordstown OH, Milam County TX)
- **Combined Capacity:** Nearly 7 GW planned, $400B+ investment
- **International:** UAE Stargate planned to open 2026
- **Challenges:** Some aspects delayed due to market uncertainty, trade policy, AI hardware valuations

### Key Industry Trends
- Hyperscalers pushing for 12-14 month delivery timelines (vs. traditional 24-36 months)
- Supply-constrained, not demand-constrained
- 75% of aggregate hyperscaler CAPEX in 2026 for AI infrastructure
- Combined Big 5 spending: ~$660-690 billion in 2026
- 36+ projects ($162B) blocked or significantly delayed (as of June 2025)

---

## 3. RFS (Ready for Service) Timelines

### By Data Center Type

| DC Type | Typical RFS Timeline | Construction Duration | Commissioning Duration |
|---------|---------------------|----------------------|----------------------|
| **Colocation (existing capacity)** | Days to weeks | N/A (pre-built) | Minimal |
| **Colocation (custom build)** | 3-6 months | 1-3 months | 2-4 weeks |
| **Edge / Micro DC** | 3-6 months | 2-4 months | 2-4 weeks |
| **Modular / Prefabricated** | 4-8 months | 3-6 months (120 days assembly) | 1-3 months |
| **Build-to-Suit (Colo for Hyperscaler)** | ~12 months | 6-9 months | 2-4 months |
| **Enterprise (Tier III)** | 12-18 months | 8-14 months | 3-5 months |
| **Hyperscale (self-built)** | 18-36+ months | 12-24 months | 3-6 months |
| **AI/HPC (complex)** | 24-36+ months | 18-30 months | 4-6 months |
| **Mega Campus (phased)** | 36-60+ months (full) | Phased over years | Per phase: 3-6 months |

### By Uptime Tier

| Tier | Typical Build + Commission | Estimated Cost |
|------|---------------------------|---------------|
| **Tier I** (Basic) | 6-12 months | $5M-$25M |
| **Tier II** (Redundant) | 8-14 months | $15M-$75M |
| **Tier III** (Concurrently Maintainable) | 12-18 months | $50M-$250M |
| **Tier IV** (Fault Tolerant) | 18-24+ months | $500M+ |

### Regional Variations
- **North America:** ~15 months for 10 MW hall
- **South America:** ~24 months for 10 MW hall
- **Asia-Pacific:** Growing fast but infrastructure constraints
- **Europe/Middle East:** Grid constraints causing delays

### Speed Records & Benchmarks
- **xAI Colossus:** 122 days (100K GPU cluster, repurposed building)
- **Modular DC assembly:** 120 days on-site
- **Industry target (hyperscalers):** 12-14 months ground-to-live
- **Traditional hyperscale:** 18-24 months
- **Complex AI facilities:** 24-36 months

### Key Bottleneck: Equipment Lead Times
- Large power transformers: up to 4 years (was 40 weeks pre-2020)
- Transformer costs up 77-95% since 2019
- Switchgear, cabling, prefab electrical systems: measured in years
- These delays are the #1 schedule risk

---

## 4. Commissioning Cost Benchmarks

### As Percentage of Construction CAPEX

| Source / Scope | % of CAPEX | Notes |
|---------------|-----------|-------|
| **General building commissioning** | 0.5-2% | Empirical figure, varies by complexity |
| **Data center commissioning (isolated)** | 1-4% | Specifically for DC projects |
| **Complex Tier III/IV commissioning** | 3-5% | With full L1-L5 and re-testing |
| **Soft costs bucket (design + PM + Cx + permits + contingency)** | 10-15% | Commissioning is one component |
| **Planning + Design + Commissioning combined** | 20-25% | Full pre-operational costs |

### Per-MW Cost Context

| Metric | Value |
|--------|-------|
| Traditional DC cost per MW | $8-12 million |
| AI-ready DC cost per MW | $20+ million |
| Cost per gross sq ft | $625-$1,135 |
| Electrical systems as % of CAPEX | 40-45% |
| Mechanical/cooling as % of CAPEX | 15-20% |
| Building shell/structure as % of CAPEX | 13-20% |
| Fire suppression as % of CAPEX | 2-5% |
| IT infrastructure as % of CAPEX | 5-10% |
| Land & site prep as % of CAPEX | 4-15% |

### Commissioning Cost Estimation

For calculator purposes, use these ranges:

| DC Type | Cx % of CAPEX (Low) | Cx % of CAPEX (Mid) | Cx % of CAPEX (High) |
|---------|---------------------|---------------------|----------------------|
| Edge/Modular (Tier I-II) | 0.5% | 1.0% | 2.0% |
| Enterprise (Tier III) | 1.5% | 2.5% | 4.0% |
| Hyperscale (Tier III-IV) | 2.0% | 3.0% | 5.0% |
| AI/HPC (Tier IV) | 3.0% | 4.0% | 6.0% |

### Factors Affecting Commissioning Cost
- Facility complexity and Tier level
- Number of systems and redundancy (N+1, 2N, 2N+1)
- Total MW capacity
- Client's involvement level and standards
- Number of commissioning activities and disciplines
- Whether Uptime Institute certification is pursued
- Geographic location (labor rates)
- Re-testing frequency for failed items

### ROI of Commissioning
- Significant savings achieved elsewhere in the project process
- Short payback period
- Prevents costly post-occupancy failures
- Training during commissioning reduces operational risk
- Issues caught early are orders of magnitude cheaper to fix

---

## 5. Key Deliverables Per Phase

### L0: Design & Planning
- [ ] Commissioning Plan
- [ ] Owner's Project Requirements (OPR)
- [ ] Basis of Design (BOD)
- [ ] Sequence of Operations (SOO)
- [ ] BMS Graphics Document
- [ ] BMS Points List
- [ ] Fire Cause & Effect Matrix
- [ ] Commissioning Schedule
- [ ] Risk Register
- [ ] Testing Scripts/Procedures Framework

### L1: Factory Acceptance Testing
- [ ] FAT Test Scripts per equipment type
- [ ] Factory Test Reports
- [ ] QA/QC Inspection Records
- [ ] Red Tags (per equipment)
- [ ] Confirmation to Ship Certificates
- [ ] Equipment Calibration Certificates
- [ ] Level 1 Close-Out Report

### L2: Delivery & Installation
- [ ] Delivery Inspection Records
- [ ] Installation Verification Checklists
- [ ] Pre-Start-Up / Energization Inspections
- [ ] Insulation Resistance Test Results
- [ ] Contact Resistance Test Results
- [ ] Phase Rotation Verification
- [ ] Torque Value Records
- [ ] Cable Routing Quality Reports
- [ ] Nameplate Data Verification
- [ ] Yellow Tags (per equipment)
- [ ] Level 2 Close-Out Report

### L3: System Start-Up
- [ ] Energization Sequence Records
- [ ] Individual System Test Reports
- [ ] Point-to-Point Verification Records
- [ ] Sensor Calibration Records
- [ ] Daily Commissioning Updates
- [ ] Operation & Maintenance Manuals (draft)
- [ ] Data Hall Clean Certification
- [ ] Green Tags (per system)
- [ ] Deficiency/Punch List
- [ ] Level 3 Close-Out Report

### L4: Functional Performance Testing
- [ ] FPT Test Scripts per system
- [ ] System Performance Test Reports
- [ ] Failure Scenario Test Results
- [ ] Load Test Reports
- [ ] Interlock Verification Records
- [ ] SOO Verification Records
- [ ] Control Loop Verification
- [ ] Test Data Downloads and Analysis
- [ ] Daily Coordination Workshop Minutes
- [ ] Daily Commissioning Updates
- [ ] Final O&M Manuals
- [ ] Blue Tags (per system)
- [ ] Updated Deficiency/Punch List
- [ ] Level 4 Close-Out Report

### L5: Integrated System Testing
- [ ] IST Test Scripts (all scenarios)
- [ ] TOAT (Total Power Outage Test) Report
- [ ] Redundancy Test Reports
- [ ] Integrated Performance Test Reports
- [ ] Timestamped Data Capture (power, cooling, controls)
- [ ] Cause & Effect Analysis Reports
- [ ] Load Bank Test Reports
- [ ] Alarm Propagation Verification
- [ ] BMS/EPMS Integration Verification
- [ ] Daily Commissioning Updates
- [ ] Commissioning Focused Reports
- [ ] White Tags (per integrated system)
- [ ] Level 5 Close-Out Report

### L6: Closeout & Handover
- [ ] Final Commissioning Report
- [ ] Systems Manual
- [ ] Complete O&M Manual Set
- [ ] As-Built Drawings
- [ ] All Test Certificates compiled
- [ ] Deficiency Resolution Records
- [ ] Plant Settings Documentation
- [ ] Lessons Learned Document
- [ ] Training Records
- [ ] Warranty Documentation
- [ ] Spare Parts Inventory
- [ ] Emergency Procedures Manual

---

## 6. Systems to Commission

### Electrical Systems

#### Medium Voltage (MV)
- MV switchgear (incoming utility)
- MV/LV transformers (step-down)
- MV generator tie-ins
- MV bus sections and couplers
- Protection relays and coordination
- Arc flash analysis verification

#### Low Voltage (LV)
- LV switchboards and panelboards
- Main distribution boards (MDB)
- Sub-distribution boards (SDB)
- Automatic Transfer Switches (ATS)
- Static Transfer Switches (STS)
- Power factor correction equipment

#### UPS Systems
- UPS modules (20 kW to 1,600 kW rated)
- UPS paralleling configurations (N+1, 2N)
- Battery systems (VRLA, Li-ion)
- Battery monitoring systems
- Bypass switches (manual and automatic)
- UPS battery runtime testing

#### Generators
- Diesel generator sets
- Generator paralleling switchgear
- Automatic start sequences
- Fuel systems (day tanks, bulk storage)
- Exhaust systems
- Load sharing and synchronization
- Wet-stacking prevention testing

#### Power Distribution
- Floor-mounted PDUs (50 kW to 500 kW rated)
- Rack-mounted PDUs (intelligent/metered)
- Remote Power Panels (RPP)
- Busway systems (A+B redundant feeds)
- Cable trays and routing

#### Monitoring & Protection
- Electrical Power Monitoring System (EPMS)
- Power quality meters
- Infrared scanning of connections
- Circuit protection coordination
- Ground fault protection

### Mechanical / Cooling Systems

#### Chiller Plant
- Centrifugal/screw chillers
- Chilled water pumps (primary, secondary, tertiary)
- Cooling towers / dry coolers
- Condenser water pumps
- Chemical treatment systems
- Plate heat exchangers / economizers
- Thermal energy storage (where applicable)

#### Air Handling
- Computer Room Air Handlers (CRAH)
- Computer Room Air Conditioners (CRAC)
- Direct expansion (DX) air handlers
- Hot aisle/cold aisle containment
- Raised floor plenum systems
- Overhead ducting systems
- Exhaust fans
- In-row cooling units

#### Piping Systems
- Chilled water piping
- Condenser water piping
- Refrigerant piping
- Glycol systems
- Isolation valves
- Control valves
- Pipe insulation and vapor barriers

#### Liquid Cooling (AI/HPC)
- Direct-to-chip liquid cooling
- Immersion cooling systems
- Coolant distribution units (CDU)
- Rear-door heat exchangers

### Fire Suppression
- Very Early Smoke Detection Apparatus (VESDA)
- Smoke detectors (photoelectric, ionization)
- Clean agent suppression (FM-200, Novec 1230, IG-541)
- Pre-action sprinkler systems
- Fire alarm control panel (FACP)
- Fire dampers
- Emergency power-off (EPO) integration
- Stairwell pressurization
- Fire barriers and penetration seals

### Security Systems
- Access control systems (card readers, biometric)
- CCTV/surveillance cameras
- Intrusion detection systems
- Perimeter security (fencing, bollards)
- Mantrap/sally port doors
- Visitor management systems
- Security operations center (SOC) integration

### Building Management System (BMS) / DCIM
- BMS controllers and sensors
- DCIM software integration
- Environmental monitoring (temperature, humidity)
- Leak detection systems
- EPMS integration
- Energy metering and sub-metering
- Alarm management and escalation
- Dashboard and reporting interfaces
- IT room pressurization monitoring
- Trend logging and data historian

### Network / ICT Infrastructure
- Structured cabling (fiber, copper)
- Network switches and routers
- Meet-me rooms
- Cable management and labeling
- Fiber optic testing (OTDR)
- Cross-connect verification
- DNS/DHCP/IP addressing
- Out-of-band management network

---

## 7. Standards & Codes

### ASHRAE (American Society of Heating, Refrigerating and Air-Conditioning Engineers)
- **ASHRAE Guideline 0-2019:** The Commissioning Process (most comprehensive, user-friendly commissioning guideline)
- **ASHRAE Standard 202-2018:** Commissioning Process for Buildings and Systems
- **ASHRAE GPC-1.6:** Commissioning of Data Centers (DC-specific, development started 2018)
- **ASHRAE Standard 90.4:** Energy Standard for Data Centers
- **ASHRAE Thermal Guidelines:** Environmental temperature and humidity ranges for computing hardware

### Uptime Institute
- **Tier Classification System:** Tier I-IV standards for availability and performance
- **TCDD:** Tier Certification of Design Documents (valid 2 years)
- **TCCF:** Tier Certification of Constructed Facility
- **TCOS:** Tier Certification of Operational Sustainability
- Over 4,000 certifications issued in 122+ countries

### NFPA (National Fire Protection Association)
- **NFPA 75:** Standard for the Fire Protection of Information Technology Equipment
- **NFPA 76:** Standard for the Fire Protection of Telecommunications Facilities
- **NFPA 70 (NEC):** National Electrical Code
- **NFPA 70E:** Standard for Electrical Safety in the Workplace
- **NFPA 70B:** Recommended Practice for Electrical Equipment Maintenance
- **NFPA 855:** Standard for the Installation of Stationary Energy Storage Systems
- **NFPA 1:** Fire Code (energy storage systems provisions)

### BICSI
- **ANSI/BICSI 002:** Data Center Design and Implementation Best Practices
  - Covers: site selection, building design, electrical, mechanical, cabling, security, commissioning, maintenance
  - Incorporates standards from ISO, TIA, CENELEC, ASHRAE, Open Compute Project

### IEC / ISO
- **ISO/IEC 24764:** Information Technology - Generic Cabling for Data Center Premises
- **IEC 62040:** UPS systems standards
- **IEC 61439:** Low-voltage switchgear and control gear assemblies

### NETA (International Electrical Testing Association)
- Electrical testing and certification standards
- Acceptance Testing Specifications (ATS)
- Maintenance Testing Specifications (MTS)

### IEEE
- **IEEE 3006 series:** Power systems analysis in industrial and commercial facilities
- **IEEE 142:** Grounding of industrial and commercial power systems
- **IEEE 1584:** Arc flash hazard calculations

### Other Standards
- **TIA-942:** Telecommunications Infrastructure Standard for Data Centers
- **EN 50600:** Information technology — Data centre facilities and infrastructures (European)
- **LEED:** Leadership in Energy and Environmental Design (commissioning is a requirement for LEED certification)
- **BSRIA:** Building Services Research and Information Association (commissioning frameworks)
- **BCxA:** Building Commissioning Association

---

## 8. Gantt Chart Structure

### Overall Project Timeline (Hyperscale Example: 18-24 months)

```
Phase                           Month
                    1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18 19 20 21 22 23 24
Planning & Feasibility  ████████████
Design & Engineering       ████████████████████████
Permits & Approvals     ██████████████████████████████
Site Preparation                          ██████████
Civil/Structural                             ████████████████
MEP Installation                                   ████████████████████████
L1: Factory Testing           ████████████████████████████████
L2: Installation QC                                      ████████████████████
L3: System Start-Up                                                  ████████████
L4: FPT                                                                    ████████
L5: IST                                                                          ████████
L6: Handover                                                                          ████
IT Equipment Install                                                                ████████
RFS / Go-Live                                                                              █
```

### Commissioning Phase Detail (3-6 month window)

```
Activity                        Week
                    1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18 19 20 21 22 23 24
L3: Electrical Start-Up  ████████████
L3: Mechanical Start-Up     ████████████
L3: Fire/Security Start-Up     ████████
L3: BMS Commissioning        ████████████
L4: Electrical FPT                    ████████
L4: Mechanical FPT                       ████████
L4: Fire/Security FPT                      ██████
L4: BMS/DCIM FPT                           ████████
Punch List Resolution                  ████████████████████
L5: Utility Failure Tests                            ████
L5: Generator Tests                                  ████
L5: UPS Transfer Tests                               ████
L5: TOAT (Blackout)                                     ████
L5: Cooling Failure Tests                               ████
L5: Integrated Alarm Tests                              ████
L5: Load Bank Testing                                      ████████
L5: 72-hr Soak Test                                           ████
L6: Documentation                                          ████████████
L6: Training                                                  ████████
L6: Final Walkthrough                                               ████
L6: Handover                                                           ██
```

### Key Dependencies (Finish-to-Start unless noted)

1. **L0 (Design) → L1 (FAT):** Cannot begin factory testing without approved design
2. **L1 (FAT) → L2 (Installation):** Equipment must pass FAT before shipping to site
3. **Construction Mechanical Completion → L3 (Start-Up):** Cannot start-up before installation complete
4. **L3 (Start-Up) → L4 (FPT):** Individual systems must work before performance testing
5. **L4 (FPT) → L5 (IST):** All systems must pass FPT before integration testing
6. **L5 (IST) → L6 (Handover):** Must pass IST before handover
7. **L4/L5 overlap possible:** Some L5 tests can begin while late L4 items complete
8. **Punch List:** Runs in parallel from L3 through L5, must be resolved before L6

### Typical Phase Durations by DC Type

| Phase | Edge/Modular | Enterprise Tier III | Hyperscale | AI/HPC |
|-------|-------------|-------------------|-----------|--------|
| L0: Design/Planning | 1-2 months | 2-4 months | 3-6 months | 4-8 months |
| L1: FAT | 2-4 weeks | 1-3 months | 2-6 months | 3-8 months |
| L2: Install QC | 1-2 weeks | 2-6 weeks | 4-12 weeks | 6-16 weeks |
| L3: Start-Up | 1-2 weeks | 2-4 weeks | 3-6 weeks | 4-8 weeks |
| L4: FPT | 1-2 weeks | 2-4 weeks | 3-6 weeks | 4-8 weeks |
| L5: IST | 3-5 days | 1-3 weeks | 2-4 weeks | 3-6 weeks |
| L6: Handover | 1 week | 1-2 weeks | 2-4 weeks | 2-4 weeks |
| **Total Cx Duration** | **6-10 weeks** | **3-5 months** | **4-7 months** | **6-10 months** |

---

## 9. Testing Protocols

### FAT (Factory Acceptance Testing)
- **Location:** Manufacturer's facility
- **Conducted by:** Vendor, witnessed by CxA
- **Purpose:** Verify equipment meets specifications before shipping
- **Typical Tests:**
  - Visual inspection against drawings
  - Dimensional verification
  - Functional operation under controlled conditions
  - Control system I/O verification
  - Software functionality tests
  - Interlock testing
  - Instrument calibration verification
  - Performance curves verification
  - Documentation review
- **Pass Criteria:** Equipment functions per specifications, all deficiencies resolved pre-shipment

### SAT (Site Acceptance Testing)
- **Location:** Customer's site, post-installation
- **Conducted by:** CxA + Contractor
- **Purpose:** Verify equipment undamaged by transport, correctly installed
- **Typical Tests:**
  - Physical inspection (damage, completeness)
  - Installation verification (clearances, alignment, levelness)
  - Electrical tests: megger, ductor, phase rotation
  - Mechanical tests: leak testing, alignment
  - Labeling verification
  - Grounding verification
  - Interface verification with monitoring systems
- **Pass Criteria:** Installation matches design, manufacturer specs, and local codes

### PVT (Pre-Verification Testing)
- **Location:** On-site (pre-functional stage)
- **Conducted by:** Contractor teams
- **Purpose:** Prepare for formal CxA-witnessed testing, catch issues early
- **Impact:** One healthcare facility reduced issues from 300 to 3 using PVT
- **Typical Tests:**
  - Contractor self-verification of installation quality
  - Pre-run of formal test scripts
  - Identification and resolution of issues before CxA involvement
- **Pass Criteria:** Construction teams confirm readiness for formal testing

### FPT (Functional Performance Testing)
- **Location:** On-site
- **Conducted by:** CxA with contractor support
- **Purpose:** Validate individual system performance under various conditions
- **Typical Tests:**
  - **Electrical:**
    - Switchgear: breaker trip settings, relay coordination, transfer sequences
    - Generators: auto-start, paralleling, load sharing, synchronization
    - UPS: charge/discharge cycles, bypass operation, battery runtime
    - PDUs: load balancing, alarm thresholds
  - **Mechanical:**
    - Chillers: load testing at various conditions (25%, 50%, 75%, 100%)
    - CRAHs: airflow verification, setpoint response
    - Pumps: flow rates, pressure drops
    - Cooling towers: approach temperature verification
  - **Controls:**
    - BMS point verification
    - Alarm generation and propagation
    - Setpoint control accuracy
    - Trending and data logging
  - **Failure Scenarios:**
    - Single component failure response
    - Redundancy switchover verification
    - Alarm escalation paths
- **Pass Criteria:** Systems operate within design parameters under all tested conditions

### IST (Integrated Systems Testing)
- **Location:** On-site (facility-wide)
- **Conducted by:** CxA leading all disciplines
- **Purpose:** Validate all systems work together under real-world scenarios
- **Typical Test Scenarios:**
  1. **Total Power Outage Test (TOAT):**
     - Simulate complete utility power loss
     - Verify UPS sustains load during generator start
     - Verify generators start and synchronize
     - Verify automatic load transfer
     - Verify cooling response to power event
     - Verify BMS/EPMS alarm cascade
  2. **Utility Power Restoration:**
     - Re-energize utility
     - Verify retransfer from generators
     - Verify generator cooldown and shutdown
  3. **Single Generator Failure:**
     - Remove one generator during utility outage
     - Verify remaining generators handle load
     - Verify load shedding if needed
  4. **UPS Module Failure:**
     - Simulate UPS failure during normal operation
     - Verify redundant UPS picks up load
     - Verify no IT load interruption
  5. **Cooling System Failure:**
     - Simulate chiller failure
     - Verify backup cooling activates
     - Monitor temperature rise rates
     - Verify alarm thresholds
  6. **Fire Alarm Integration:**
     - Trigger fire alarm
     - Verify clean agent release sequence
     - Verify HVAC damper closure
     - Verify EPO integration (if applicable)
  7. **72-Hour Soak/Burn-In Test:**
     - Run facility at design load for 72 continuous hours
     - Monitor all systems for stability
     - Capture comprehensive performance data
- **Pass Criteria:** All systems respond correctly to all scenarios, no IT load interruptions, all alarms propagate correctly

### Load Bank Testing
- **Purpose:** Simulate IT load when actual servers not yet installed
- **Types:**
  - Resistive load banks (most common)
  - Reactive load banks (when power factor testing needed)
- **Applications:**
  - Generator full-load testing
  - UPS full-load and battery runtime testing
  - PDU capacity verification
  - Thermal load simulation for cooling validation
- **Frequency:** During commissioning + annually for generators (prevent wet-stacking)

---

## 10. Common Failures & Risks

### Top 10 Commissioning Failures

1. **Late Commissioning Integration**
   - Commissioning agent engaged too late in process
   - Compressed schedules, rushed testing
   - Hidden costly issues not caught until operation
   - **Mitigation:** Engage CxA during design phase

2. **Imbalanced Testing Focus**
   - Too much time on minutiae (minor alarm points)
   - Not enough time on big-picture integration
   - OR skipping L3/L4 to rush to L5 (IST)
   - **Mitigation:** Balanced commissioning plan with clear time allocation

3. **Inadequate Planning**
   - Treating commissioning as construction activity, not engineering
   - Gaps in testing coverage
   - Missing critical integration points
   - **Mitigation:** Dedicated commissioning plan from L0

4. **Boilerplate Approaches**
   - "One size fits all" forms with little understanding of actual equipment
   - Technicians glossing over unfamiliar equipment
   - Vendor technicians unfamiliar with their own equipment features
   - **Mitigation:** Customized, site-specific commissioning process

5. **Incomplete Documentation**
   - Reports fail to articulate what was tested, how, when, and results
   - Operators lack essential information about system capabilities
   - **Mitigation:** Rigorous documentation standards from day one

6. **Unrealistic Testing Conditions**
   - Testing parts in isolation without simulating real conditions
   - Not using load banks to simulate actual IT loads
   - **Mitigation:** Full load testing with load banks or actual IT equipment

7. **Vendor Interface Failures**
   - Systems from different vendors don't integrate properly
   - Individual vendor systems work fine; integration fails
   - Alarm mapping errors between systems
   - **Mitigation:** Early integration planning, multi-vendor testing

8. **Control System Failures**
   - Primary cause of data center outages
   - BMS programming errors
   - AHUs failing to respond to emergency commands despite HMI showing activation
   - **Mitigation:** Thorough control system verification at L3/L4

9. **Operations Team Exclusion**
   - No live training during commissioning
   - Procedures not verified during testing
   - Team not ready for maintenance or failures at go-live
   - **Mitigation:** Include operations team from L4 onwards

10. **Post-Commissioning Transition Failures**
    - Lessons learned not captured
    - Documentation not finalized quickly
    - Maintenance programs not established before go-live
    - **Mitigation:** Formal L6 handover process with defined timeline

### Systems Most Likely to Fail Post-Turnover
1. UPS systems
2. Backup generators
3. Mechanical and cooling systems
4. Pumps
5. Control system integration points

### Risk Mitigation Framework

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Equipment delivery delays | High | High | Early FAT, buffer schedule |
| Transformer lead times (up to 4 years) | High | Critical | Pre-order 2+ years ahead |
| Failed L5 IST scenarios | Medium | High | Thorough L3/L4 completion |
| Vendor integration issues | High | Medium | Multi-vendor integration testing |
| Compressed commissioning schedule | High | High | Protect commissioning time contractually |
| Skilled labor shortage | High | Medium | Pre-commit commissioning resources |
| Power availability delays | Medium | Critical | Utility engagement from L0 |
| BMS programming errors | Medium | Medium | Point-by-point verification |
| Alarm mapping errors | High | Medium | Systematic alarm verification |
| Fire suppression coordination | Low | High | Dedicated fire system commissioning |
| Documentation gaps | Medium | Medium | Real-time documentation requirements |
| Weather/seasonal impacts | Low | Low | Indoor commissioning where possible |

---

## Sources

### Commissioning Phases & Levels
- [Construct & Commission - 5 Levels of Commissioning Explained](https://constructandcommission.com/5-levels-of-commissioning-explained-data-center/)
- [EIDA Solutions - Guide to 5 Levels of Data Centre Commissioning](https://www.eidasolutions.com/a-guide-to-the-5-levels-of-data-centre-commissioning/)
- [CxPlanner - Data Centers Level Testing](https://cxplanner.com/data-centers/resources/data-centers-level-testing)
- [DataKnox - Eight Stages of Data Center Commissioning](https://www.dataknox.io/blog/eight-stages-of-data-center-commissioning-breakdown)
- [DataKnox - 5 Stages of Data Center Commissioning](https://www.dataknox.io/blog/5-stages-of-data-center-commissioning)
- [BMP MEP Contractor - Understanding L1-L5 Commissioning](https://bmp-mepcontractor.com/understanding-l1-l5-commissioning-in-data-centre-projects-ensuring-reliability-integration-and-operational-readiness/)
- [DataXConnect - The 5 Data Centre Commissioning Levels](https://dataxconnect.com/insights-data-centre-commissioning-levels/)
- [JLL - Seven Stages of Data Center Commissioning](https://www.jll.com/en-us/guides/do-you-know-the-seven-stages-of-data-center-commissioning)
- [BCxA - Commissioning Levels vs Process](https://www.bcxa.org/blog/commissioning-levels-%E2%89%A0-commissioning-process.html)
- [LotusWorks - Data Center Commissioning Guide](https://lotusworks.com/data-center-commissioning/)
- [Bluerithm - Guide to Data Center Commissioning](https://bluerithm.com/guide-to-data-center-commissioning/)

### Hyperscaler Approaches & Timelines
- [Data Center Knowledge - AI-First Hyperscalers 2026](https://www.datacenterknowledge.com/hyperscalers/hyperscalers-in-2026-what-s-next-for-the-world-s-largest-data-center-operators-)
- [Introl Blog - Hyperscaler CapEx $600B in 2026](https://introl.com/blog/hyperscaler-capex-600b-2026-ai-infrastructure-debt-january-2026)
- [Wikipedia - Stargate LLC](https://en.wikipedia.org/wiki/Stargate_LLC)
- [OpenAI - Announcing Stargate Project](https://openai.com/index/announcing-the-stargate-project/)
- [OpenAI - Five New Stargate Sites](https://openai.com/index/five-new-stargate-sites/)
- [Data Center Frontier - Scaling Stargate](https://www.datacenterfrontier.com/machine-learning/article/55319132/scaling-stargate-openais-five-new-us-data-centers-push-toward-10-gw-ai-infrastructure)
- [Data Center Knowledge - Opening the Stargate](https://www.datacenterknowledge.com/ai-data-centers/opening-the-stargate-tech-giants-to-invest-500b-in-ai-data-center-infrastructure)
- [StruxHub - Meta Richland Data Center Timeline](https://struxhub.com/blog/what-is-the-construction-timeline-for-the-meta-richland-parish-louisiana-ai-data-center-project/)
- [Construction Dive - Oracle, Google, Meta Lead Construction Surge](https://www.constructiondive.com/news/oracle-google-meta-data-center-construction/711408/)
- [Oracle - Data Center in Michigan](https://www.oracle.com/news/announcement/blog/oracle-is-set-to-power-on-new-data-center-in-michigan-2025-1018/)

### RFS Timelines & Construction
- [Green Mountain - How Long to Build a Data Center](https://greenmountain.no/build-a-data-center/)
- [MASTT - Data Center Construction Costs Timeline](https://www.mastt.com/guide/data-center-construction)
- [LVI Associates - Hidden Timeline of DC Builds](https://www.lviassociates.com/en-us/industry-insights/hiring-advice/the-hidden-timeline-of-data-center-builds)
- [TrueLook - Data Center Construction](https://www.truelook.com/blog/data-center-construction)
- [Cadence - Hyperscale Data Center Construction Workflows](https://cadencenow.com/hyperscale-data-center-construction-workflows/)
- [Data Center Knowledge - Contractors Adapting to Accelerate Schedules](https://www.datacenterknowledge.com/data-center-construction/how-contractors-are-adapting-to-accelerate-data-center-build-schedules)
- [Bain & Company - Next Phase of Data Center Growth](https://www.bain.com/about/media-center/press-releases/20252/next-phase-of-data-center-growth-to-be-more-disciplined-but-risks-of-power-constraints-and-construction-delays-remain-bain--co-research/)
- [Data Center Knowledge - Higher Loads Faster Builds 2026](https://www.datacenterknowledge.com/data-center-construction/higher-loads-faster-builds-six-trends-defining-data-centers-in-2026)
- [Data Center Asia - How Long to Build a Data Center](https://www.datacenter-asia.com/blog/how-long-does-it-take-to-build-a-data-center/)
- [Ingenious Build - Build a Data Center Without Going Over Budget](https://www.ingenious.build/blog-posts/how-to-build-a-data-center-without-going-over-budget-in-2025)

### Cost Benchmarks
- [Alpha-Matica - Deconstructing the Data Center Cost Structure](https://www.alpha-matica.com/post/deconstructing-the-data-center-a-look-at-the-cost-structure-1)
- [Turner & Townsend - DC Construction Cost Index 2025-2026](https://www.turnerandtownsend.com/insights/data-centre-construction-cost-index-2025-2026/)
- [McKinsey - The Cost of Compute $7 Trillion Race](https://www.mckinsey.com/industries/technology-media-and-telecommunications/our-insights/the-cost-of-compute-a-7-trillion-dollar-race-to-scale-data-centers)
- [BlueCap - Cost Data Center](https://www.bluecapeconomicadvisors.com/post/cost-data-center)
- [CxPlanner - What Does Commissioning Cost](https://cxplanner.com/commissioning-101/what-does-commissioning-cost)
- [Dgtl Infra - How Much Does It Cost to Build a Data Center](https://dgtlinfra.com/how-much-does-it-cost-to-build-a-data-center/)
- [TrueLook - Data Center Construction Costs Explained](https://www.truelook.com/blog/data-center-construction-costs)
- [Schneider Electric - Data Center Capital Cost Calculator](https://www.se.com/ww/en/work/solutions/system/s1/data-center-and-network-systems/trade-off-tools/data-center-capital-cost-calculator/)

### Standards & Codes
- [CSE Magazine - Data Centers Codes and Standards](https://www.csemag.com/data-centers-achieve-a-new-level-of-high-tech-codes-and-standards/)
- [ASHRAE - Guideline 1.6 Data Center Commissioning](https://www.achrnews.com/articles/163600-ashrae-guideline-16-data-center-commissioning)
- [Amphenol Sensors - Key Data Center Design Standards](https://blog.amphenol-sensors.com/industrial-blog/data-center-design-standards)
- [Uptime Institute - Tier Certification](https://uptimeinstitute.com/tier-certification)
- [Uptime Institute - Tier Classification System](https://uptimeinstitute.com/tiers)
- [BICSI 002 - Data Center Design Standards](https://www.scribd.com/document/420880936/Bicsi-002-Data-Center-Design-and-Implementation-Best-Practices)
- [Construct & Commission - Uptime Tier Ratings](https://constructandcommission.com/uptime-tier-ratings-steps-to-obtain-them/)
- [Ingenious Build - Data Center Tiers Explained 2026](https://www.ingenious.build/blog-posts/data-center-tiers-explained)

### Testing Protocols
- [CxPlanner - Integrated System Testing](https://cxplanner.com/commissioning-101/integrated-system-testing)
- [RentaLoad - Commissioning Tests for Data Centers](https://rentaload.com/en/use-load-bank/test-ist-commissioning/)
- [Facility Grid - Pre-Verification Testing Best Practices](https://facilitygrid.com/blog/best-practices-pre-verification-testing/)
- [OPAL-RT - 7 Key Steps for DC Commissioning](https://www.opal-rt.com/blog/7-key-steps-for-data-center-commissioning-and-testing/)
- [Cadence - Commissioning and Testing in DC Construction](https://cadencenow.com/commissioning-and-testing-in-data-center-construction/)
- [TechSite - Commissioning Critical Systems in Hyperscale DCs](https://techsiteplan.com/commissioning-critical-systems-in-hyperscale-data-centers/)
- [Aggreko - Data Center Commissioning & Testing](https://www.aggreko.com/en-us/sectors/data-centres/data-centre-commissioning)
- [Broadstaff - Electrical Commissioning Engineer in DC](https://broadstaffglobal.com/electrical-commissioning-engineer-data-center)
- [QuadPlus - Data Center Power Testing](https://quadplus.com/data-centers/)
- [CSE Magazine - Commissioning Best Practices Electrical](https://www.csemag.com/commissioning-best-practices-electrical/)

### Failures & Risks
- [DCSMI - 6 Commissioning Mistakes](https://www.dcsmi.com/data-center-sales-and-marketing-blog/6-data-center-commissioning-mistakes-you-cant-afford-to-make)
- [Facilities Net - Common Problems with DC Commissioning](https://www.facilitiesnet.com/datacenters/article/Common-Problems-With-Data-Center-Commissioning--14688)
- [Ping CX - When Failure Is Not an Option](https://www.pingcx.com/blog/data-center-commissioning-when-failure-is-not-an-option)
- [AuditCo - Common Pitfalls and How CXA Services Prevent Them](https://auditco.co.uk/data-center-commissioning-common-pitfalls-and-how-professional-cxa-services-prevent-them/)
- [JLL - Commissioning Strategies for Uninterrupted Performance](https://www.jll.com/en-us/insights/commissioning-strategies-to-ensure-uninterrupted-data-center-performance)
- [Uptime Institute - Improve Project Success Through Commissioning](https://journal.uptimeinstitute.com/improve-project-success-through-mission-critical-commissioning/)
- [PLANNET - Common Problems with DC Commissioning](https://plannet.com/common-problems-with-data-center-commissioning/)
- [Uptime Institute - Avoiding DC Construction Problems](https://journal.uptimeinstitute.com/avoiding-data-center-construction-problems/)
- [SOCOTEC - Building Envelope Commissioning Lessons Learned](https://www.socotec.us/blog/building-envelope-commissioning-lessons-learned-from-data-center-construction)
- [Allianz - Data Center Construction Boom Risks](https://commercial.allianz.com/content/dam/onemarketing/commercial/commercial/reports/commercial-data-center-construction-risks.pdf)

### Market Data
- [Futurum - AI Capex 2026 $690B Infrastructure Sprint](https://futurumgroup.com/insights/ai-capex-2026-the-690b-infrastructure-sprint/)
- [Programs.com - Data Center Statistics 2026](https://programs.com/resources/data-center-statistics/)
- [Network Installers - 30+ DC Construction Statistics 2026](https://thenetworkinstallers.com/blog/data-center-construction-statistics/)
- [ABI Research - How Many Data Centers and Where](https://www.abiresearch.com/blog/data-centers-by-region-size-company)
- [Business Wire - Global DC Construction Project Insights 2025](https://www.businesswire.com/news/home/20251223139229/en/Global-Data-Center-Construction-Project-Insights-Report-2025)
