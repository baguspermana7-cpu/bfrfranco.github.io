# Data Center Commissioning — Detailed Test Protocols & Equipment Costs
## Supplemental Research for DC Commissioning Calculator
### Research Date: 2026-03-18

---

## Table of Contents

1. [Electrical Systems Testing](#1-electrical-systems-testing)
2. [Mechanical Systems Testing](#2-mechanical-systems-testing)
3. [Fire Protection Testing](#3-fire-protection-testing)
4. [BMS/DCIM Testing](#4-bmsdcim-testing)
5. [Security Systems Testing](#5-security-systems-testing)
6. [Network/ICT Testing](#6-networkict-testing)
7. [Integrated Systems Testing (IST)](#7-integrated-systems-testing-ist)
8. [Commissioning Documentation](#8-commissioning-documentation)
9. [Testing Equipment Costs](#9-testing-equipment-costs)

---

## 1. Electrical Systems Testing

### 1a. Medium Voltage Switchgear Acceptance Testing

**Standards:** ANSI/NETA ATS-2025, IEEE C37, ANSI C37.09

**Test Sequence (must be performed in order):**

1. **Visual & Mechanical Inspection**
   - Verify nameplate data against one-lines and schematics
   - Check tightness of all bolted connections (torque wrench method)
   - Verify all wiring correct per approved drawings
   - Manually exercise all switches, breakers, and mechanisms for proper alignment
   - Check CT/VT installation, polarity, and connections

2. **Insulation Resistance Testing (Megger)**
   - Equipment: 5 kV DC megohmmeter (1 minute application minimum)
   - Test across 3 phases: line-to-line and line-to-ground
   - Test with breaker in OPEN and CLOSED positions
   - Bus insulation tested one phase to ground, other two phases grounded
   - Remove auxiliary equipment (PTs, lightning arresters) before testing

   **NETA Table 100.1 — Minimum Insulation Resistance Values:**

   | Nominal Rating (V) | Min Test Voltage (DC) | Min Insulation Resistance (MOhms) |
   |---|---|---|
   | 250 | 500 V | 25 |
   | 600 | 1,000 V | 100 |
   | 1,000 | 1,000 V | 100 |
   | 2,500 | 1,000 V | 500 |
   | 5,000 | 2,500 V | 1,500 |
   | 8,000 | 2,500 V | 2,500 |
   | 15,000 | 2,500 V | 5,000 |
   | 25,000 | 5,000 V | 10,000 |
   | 34,500 | 5,000 V | 100,000 |
   | 46,000+ | 5,000 V | 100,000 |

   - Control wiring: minimum 2 megohms
   - Polarization Index (PI) = R60/R15: >1.3 for voltage up to 35 kV; 1.5-1.7 for 66-500 kV

3. **Contact Resistance Testing**
   - Equipment: 4-terminal micro-ohmmeter (DLRO)
   - Two leads for current injection, two for voltage sensing
   - Industry guideline: 150-500 micro-ohms for high-current circuit breakers
   - NETA rule: investigate values deviating >50% from lowest pole or similar breaker
   - Test all breaker poles and bus connections

4. **High Potential (Hi-Pot) Testing**
   - Purpose: verify bus bar withstand voltage, vacuum bottle integrity, measure leakage current
   - Apply AC high potential voltage line-to-line and line-to-ground
   - Test with CB in service position and test position
   - Protection relays energized, VTs racked out

5. **CT/VT Testing**
   - Verify correct component and installation of PTs and CTs
   - Check control fuse size and continuity
   - Verify PT and CT polarity
   - Transformer turns ratio test
   - CT tests: ratio, polarity, burden, knee point, winding resistance, magnetization curve

6. **Protective Relay Calibration**
   - Secondary injection testing at front panel test facilities
   - Approved settings verification
   - Auxiliary/tripping relay pickup and dropout voltage verification
   - All contacts verification
   - Operation timing at 80% and 100% nominal voltage
   - Time delay relays tested at 0%, setpoint, and 100% delay
   - Current/voltage metering calibration at 0%, 25%, 50%, 100% of scale
   - Tagging: Green = tested OK; Red = defective

7. **Breaker Timing Test**
   - Measured in milliseconds
   - Closing time: signal to close coil → contacts join
   - Opening time: trip signal → contacts separate
   - Compare results to manufacturer's published data
   - Required for all oil-type and SF6 breakers (per NETA ATS)
   - Not required for insulated/molded-case breakers

8. **System Function Testing**
   - Verify all sensing devices, alarms, indicating devices
   - Function test lock-out relay, block close circuits, block reclose circuits
   - Function test bus restoration and/or transfer switches

---

### 1b. Transformer Testing

**Standards:** IEEE C57.12.00, IEEE C57.12.90 (liquid-immersed), IEEE C57.12.01, IEEE C57.12.91 (dry-type)

1. **Turns Ratio Test (TTR)**
   - Confirm winding turns ratio consistent with voltage ratio on nameplate
   - Check for shipping damage
   - Confirm tap-changer leads correctly connected
   - IEEE allowance: 0.5% variance above/below calculated value
   - Simultaneously checks polarity and phase relationships
   - Exciting current also measured

2. **Winding Resistance Test**
   - Purpose: check health of windings and connections, calculate I^2R losses
   - Transformer must be off and without excitation for 3-4 hours before measurement
   - DC measurement method: inject current (max 15% of rated current), measure voltage drop, R = V/I
   - Star-connected: resistance per phase = 0.5 x measured resistance between two line terminals
   - Delta-connected: resistance per phase = 0.67 x measured resistance between two line terminals
   - **Acceptance:** results between phases within 5% of each other (IEEE Std 62-1995)
   - Also verifies off-load tap changer, load tap changer, welded and mechanical connections

3. **Insulation Resistance Test**
   - HV winding to ground, LV winding to ground, HV to LV winding
   - DC Megger at 5,000 V, applied for 30 seconds minimum, extend to 1 minute (5 minutes if unstable)
   - Polarization Index (PI) = R60/R15: >1.3 for up to 35 kV

4. **Oil Analysis (Dissolved Gas Analysis — DGA)**
   - Draw oil sample from main tank BEFORE first energization (baseline data)
   - Second sample 24 hours after first energization
   - Gas chromatography analysis to identify fault gases
   - Identifies: thermal decomposition, partial discharge, arcing, overheating
   - Key gases monitored: H2, CH4, C2H2, C2H4, C2H6, CO, CO2

5. **Temperature Rise Test (Heat Run)**
   - Standard: IEC 60076-2
   - Usually type test on first unit of order
   - Fiber optic probes placed in winding for direct hot spot measurement
   - Procedure: short-circuit LV winding, apply voltage to HV winding
   - Continue until top oil temperature rise <3 deg C/hour or 1 deg C/hour for 4 consecutive hours
   - After completion, reduce to rated current for 1 hour, then switch off
   - Plot hot resistance vs. time to extrapolate winding temperature at shutdown
   - **Maximum permissible rise:** 65 deg C above ambient (liquid-immersed, per IEEE/IEC)

6. **Thermovision Scanning**
   - Performed after 24 hours of loading, repeated after 1 week
   - Temperature distribution on tank surface and jumper connections to bushings

---

### 1c. UPS Testing

**Testing phases:** Physical PM → Protection settings/calibration → Functional load testing

1. **Steady-State Load Testing**
   - Resistive load banks simulate operational loads
   - Record at input AND output: voltage, current, real power, apparent power, power factor, THD (voltage and current)
   - Load varied: 0%, 25%, 50%, 75%, 100% of rated capacity
   - For parallel UPS: verify equal load sharing between modules
   - Monitor efficiency, heat generation, power delivery

2. **Harmonic Analysis**
   - Measured per IEC 61000-3-4 or ENA EREC G5/5
   - Observe harmonic content at 0%, 50%, and 100% load
   - Greatest harmonic distortion at lowest load (filter design optimized for full load)
   - Three filter elements checked: input, rectifier, output
   - UPS THD specification: typically <5% THDv at output

3. **Transfer Time Testing (Static Transfer Switch)**
   - Deliberately fail primary supply
   - Monitor STS output with high-resolution transient voltage capture
   - STS transfer time target: <4 ms (typical 2-4 ms)
   - Accuracy of measurement: 100ths of a millisecond
   - **STS specifications:**
     - Thyristor-based: 2 ms typical
     - 3-phase STS: 4-8 ms
     - Rack-mount STS (e.g., Raritan): 4-6 ms

4. **Transient Response Testing**
   - Step load change 0% to 100% of UPS rating
   - Monitor minimum/maximum load voltages and recovery time
   - Recovery target: within 1% of nominal voltage within specified time

5. **Battery Discharge Testing**
   - Simulates power failure under load
   - Full load discharge for minimum 15 minutes (or per design autonomy)
   - Measure individual cell voltages before and after discharge
   - Monitor discharge rate, runtime, voltage stability
   - Wet-cell: full rundown test annually
   - VRLA: more frequent but gentler testing
   - **Replacement threshold:** battery cannot provide designed discharge time or ~80% of rated capacity

6. **Efficiency Measurement**
   - Simultaneously log 3-phase voltage, current, power, PF, harmonics, transients
   - Logging duration: 8-24 hours continuous
   - Use power quality analyzer with data logging capability

---

### 1d. Generator Testing

**Standards:** NFPA 110, NETA ATS

1. **Load Bank Testing**
   - Connect load bank per manufacturer's procedures, ensure proper grounding
   - Bring to normal operating temperature, voltage, and frequency
   - Add load in controlled increments
   - Monitor: frequency, voltage, temperature, pressure
   - Maintain each load step 30 minutes to 1 hour
   - Step loading: 25%, 50%, 75%, 100% of nameplate
   - Document readings at each stage
   - Watch for: voltage drop, frequency drift, excessive smoke, overheating
   - Gradually reduce load in stages before shutdown
   - **NFPA 110:** monthly testing at minimum 30% nameplate capacity
   - **Annual:** 2-hour load test at full load if monthly thresholds not met

2. **Synchronization Testing**
   - Multi-generator sets synchronized onto common busbar
   - Verify load sharing between modules
   - Test phase matching, frequency alignment
   - Validate paralleling switchgear operation

3. **Fuel System Verification**
   - Fuel consumption measurement at various loads
   - Fuel transfer pump testing
   - Day tank level sensor verification
   - Main storage tank level monitoring
   - Prevent wet stacking: minimum 30% load operation

4. **Exhaust Emissions**
   - Tier 4F compliance: CO, NOx, particulate matter limits
   - SCR and DPF component verification
   - Aftertreatment requires minimum exhaust temperature range
   - Load bank testing burns off accumulated deposits

5. **Black Start Test**
   - Simulate complete grid power loss
   - Measure delay from power failure to generator activation
   - Verify: fuel delivery, starter motor, control systems
   - Step-by-step:
     1. Power auxiliary systems (control, lubrication, air compressors)
     2. Energize turbines
     3. Synchronize with facility load center
     4. Bring additional units online incrementally
     5. Full plant startup
   - **Frequency:** at least annually, with monthly exercise tests

---

### 1e. ATS/STS Testing

**Transfer Time Specifications:**

| Switch Type | Transfer Time | Mechanism |
|---|---|---|
| STS (thyristor-based) | 2 ms typical | Solid-state electronics |
| STS (3-phase) | 4-8 ms | Solid-state electronics |
| STS (rack-mount) | 4-6 ms | Solid-state electronics |
| ATS (fast mechanical) | 8-16 ms | Mechanical relay |
| ATS (standard) | 50-200 ms | Mechanical contactors |

**Transfer Modes:**
- **Open Transition (Break-Before-Make):** Old connection broken before new one made; interruption <100 ms typical
- **Closed Transition (Make-Before-Break):** Sources briefly paralleled (~100 ms overlap); zero interruption to load; requires synchronization; gold standard for Tier 3/4 data centers

**IT Equipment Sensitivity Thresholds:**
- <4 ms: seamless for virtually all equipment (servers, storage, medical)
- 4-10 ms: most IT equipment tolerates
- >10 ms: risk of malfunction/data corruption for sensitive equipment (HFT, precision medical)

**Testing Requirements:**
- Commission: test under load during initial commissioning
- Monthly: test runs of generator and ATS
- Quarterly: check WCR and torque values
- Annually: full function test under simulated failure

---

### 1f. PDU Testing

1. **Load Balancing Verification**
   - Apply specific loads to individual phases using load banks
   - Verify even distribution across phases
   - Monitor for phase imbalance

2. **Monitoring Accuracy**
   - Verify power monitoring accuracy against reference instruments
   - Class 0.5 accuracy per ANSI C12.20 and IEC 61557-12

3. **Thermal Imaging Under Load**
   - Scan all connections, lugs, terminals under load
   - Look for: loose connections, overheating, "barber pole effect" on conductors
   - Identify thermal anomalies in connections, terminations, fuses, fuse clips
   - If PDU has transformer, scan the on-board transformer

4. **Communication Verification**
   - Modbus RTU/TCP, BACnet/IP, SNMPv1/v2/v3
   - Verify data reporting to BMS/EPMS

---

### 1g. Busway/Busduct Testing

1. **Bolt Torque Verification**
   - Torque wrench method per manufacturer specifications
   - Milliohm-level resistance verification at every joint
   - Insufficient torque → elevated contact resistance → overheating → fire risk

2. **Thermal Scanning Under Load**
   - Scan every lug, terminal, busway joint under load stress
   - Use load bank testing to apply realistic loads during scanning

3. **Load Bank Testing of Bus Runs**
   - Validate safe installation and operational performance before production
   - Phase balancing verification

---

### 1h. EPMS Verification

**Purpose:** Provides real-time and historical visibility of electrical systems

1. **Points Verification**
   - Confirm all metering points are correctly mapped
   - Verify scaling and engineering units
   - Check naming conventions match design documents

2. **Waveform Analysis**
   - Validate root-cause analysis capability for power disturbances
   - Verify voltage fluctuation, imbalance, and spike detection

3. **Alarm Testing**
   - Simulate alarms (e.g., jumper two terminals in control panel for "Low Fuel")
   - Verify correct alarm displays on EPMS software
   - Test notification routing and escalation

4. **Integration Testing**
   - BMS/DCIM integration verification
   - PUE calculation accuracy
   - Data trending and reporting verification
   - Communication protocols: Modbus, BACnet, SNMP

5. **Accuracy Verification**
   - Compare readings against calibrated reference instruments
   - Verify at multiple load points

---

## 2. Mechanical Systems Testing

### 2a. Chiller Testing

**Standards:** ASHRAE Guideline 0, manufacturer specifications

1. **Pre-Commissioning Checks**
   - Verify refrigerant system pressure
   - Conduct leak tests
   - Inspect for contamination or moisture
   - Check manuals, safety equipment, motor rotation
   - Verify refrigerant charge (superheat method or weigh-in method)

2. **Capacity Verification**
   - Use load banks to simulate 100% heat load in data hall
   - Verify cooling infrastructure maintains required ambient conditions
   - Record: supply/return water temperatures, flow rates, power consumption
   - Compare actual capacity to nameplate/design capacity

3. **Approach Temperature Measurement**
   - Evaporator approach: chilled water leaving temp minus refrigerant temp
   - Condenser approach: condensing temp minus cooling water outlet temp
   - Lower approach = better heat transfer efficiency
   - Typical condenser approach: ~10 deg F (5.5 deg C)

4. **COP (Coefficient of Performance) Measurement**
   - COP = Cooling Capacity (kW) / Power Input (kW)
   - Example: 2,500 kW cooling / 460 kW electricity = COP 5.4
   - Measure at multiple load points (25%, 50%, 75%, 100%)
   - Maintain constant load during each test period
   - **Common efficiency metrics:**
     - kW/ton (lower = better; typical 0.5-0.7 kW/ton for centrifugal)
     - COP (higher = better; typical 5-7 for water-cooled centrifugal)
     - EER (higher = better)
     - IPLV/NPLV for part-load performance

5. **Refrigerant Charge Verification**
   - Measure suction and discharge pressures vs. expected values
   - Check temperature/pressure at evaporator, condenser, and various system points
   - Verify temperature differential across evaporator and condenser per manufacturer specs
   - Methods: superheat calculation, subcooling measurement, weigh-in method

6. **Performance Logging**
   - Record: supply voltage, compressor/fan motor amps, refrigerant pressures
   - Water temperatures and flow rate, outdoor air temperatures
   - Check capacity, vibrations, start-up logs, oil samples after startup

---

### 2b. CRAH/CRAC Testing

1. **Temperature Control Verification**
   - CRAC precision: +/-1 deg F
   - Calibrate sensors: place calibrated handheld instrument within 100 mm (3 in.) of each sensor
   - Compare handheld reading to sensor reading at CRAC display and BMS
   - Verify supply air temperature control under varying heat loads
   - Monitor return air temperature stability

2. **Humidity Control Verification**
   - Too humid → condensation on internal components → shorts
   - Too dry → electrostatic discharge risk → shorts
   - Verify humidifier and dehumidifier operation
   - Test across ASHRAE recommended range (typically 20-80% RH, class A1-A4)

3. **Airflow Measurement**
   - Measure perforated tile rack airflow output (CFM)
   - Real-time CRAC/CRAH airflow output (CFM)
   - Rack inlet/exhaust temperatures (top/middle/bottom)
   - Underfloor air volume and pressure calculation
   - Verify hot aisle/cold aisle layout effectiveness
   - Airflow pattern modeling and CFD verification

4. **Functional Testing**
   - Check for short cycling after startup
   - Verify BMS alarm mapping
   - Test failure modes and redundancy switchover
   - Monitor condensate drain and sump pump operation

5. **Heat Load Testing**
   - Place portable or rack-level load banks at expected heat load locations
   - Monitor supply and return temperatures for stability
   - Observe airflow patterns and adjust for obstructions
   - **Acceptance criteria:** temperature within design windows, control stability, recovery times

---

### 2c. Cooling Tower Testing

1. **Approach Temperature Measurement**
   - Measure: cold water temperature leaving tower vs. ambient wet bulb temperature
   - Lower approach = more effective tower operation
   - Typical approach: 5-10 deg F (2.8-5.5 deg C)

2. **Water Treatment Verification**
   - Consult water treaters during design phase
   - Basin cleaning, fill media flushing, spray nozzle descaling
   - Verify biocide and algaecide dosing systems
   - Monitor cycles of concentration, conductivity, pH
   - Chemical treatment system startup

3. **Basin Heating/Freeze Protection**
   - Verify basin heaters maintain above-freezing temperature
   - Test heat trace on water pipes
   - Verify basin draindown procedures for cold climates

4. **Hydrostatic Pressure Testing of Piping**
   - **Test pressure:** 1.5x operating pressure for 24 hours
   - Visual inspection of all welds, flanges, hangers, penetrations first
   - Repair any leaks before cleaning begins
   - OCP guidelines: 1.3-1.5x operating capacity for rack piping

5. **High-Velocity Construction Flushing**
   - DI water circulated at 5-8 ft/sec (1.5-2.4 m/s)
   - Staged filtration: 100 um → 50 um → 25 um → 10 um
   - Removes: weld slag, metal shavings, pipe dope, flux residues, cutting oils
   - Minimum suspension velocity for particles: 0.6-0.9 m/s (2-3 fps)

---

### 2d. Pump Testing

1. **Flow Rate Verification**
   - Measure actual flow vs. design flow
   - Verify variable-speed pump operation across range

2. **Head Pressure Measurement**
   - Verify pump develops design head at design flow
   - Record differential pressure across pump

3. **Vibration Analysis**
   - Baseline vibration readings after installation
   - Check for unusual vibrations indicating misalignment
   - ISO 10816 vibration severity classification

4. **Alignment Verification**
   - Laser alignment of pump-motor coupling
   - Verify within manufacturer tolerance

---

### 2e. Piping Testing

1. **Hydrostatic Pressure Test**
   - 1.5x operating pressure for 24 hours
   - Visual inspection before and after
   - Document all leak locations and repairs

2. **Flushing**
   - High-velocity flush at 5-8 ft/sec
   - Staged filtration (100-10 um)
   - Duration: until flush water runs clear through final filter

3. **Chemical Treatment**
   - Passivation of new piping
   - Verify water chemistry meets design specifications
   - Establish baseline water quality readings

---

### 2f. Direct Liquid Cooling (DLC) Testing

1. **Leak Detection**
   - Strategic sensor placement at: couplings, joints, welds, threaded connections, crimped connections
   - Drip pans, cooling coils, heat exchangers
   - Multi-stage testing approach:
     - Component-level leak testing before assembly (cold plates, manifolds)
     - Pressure decay testing: pressurize with air, isolate, monitor for pressure drop
     - Mass-flow testing: measure flow to maintain constant pressure
     - Proof test: pressurize to 0-1000 psig range, then leak test to verify no stress-induced leaks
     - Tracer gas testing (helium or forming gas) for sensitive applications

2. **Flow Rate Verification**
   - Flow sensors calibrated and tied into BMS
   - Monitor at supply line to cold plates
   - ASHRAE TC 9.6: fluid velocity should not exceed 2.1 m/s for pipes >3 in. diameter
   - CDU variable-speed pumps verified across operating range

3. **Fluid Quality**
   - Test coolant properties: thermal conductivity, viscosity, pH, specific heat
   - Verify inhibitor concentration for corrosion protection
   - Establish baseline fluid quality readings

4. **Pressure Drop Monitoring**
   - Differential pressure across cold plates and heat exchangers
   - Supply and return pressure transducers on CDU
   - Correlate delta-P to flow rate (establish calibrated relationship)

5. **Safety Interlocks**
   - Verify: low-flow auto-throttle or orderly server shutdown
   - N+1 pump redundancy: backup pump auto-start on flow sensor feedback
   - Flow verification signal required before server power-on
   - Isolation valves at each rack for individual server isolation
   - Dripless quick-disconnect verification

---

### 2g. Rear Door Heat Exchanger (RDHX) Testing

1. **Heat Rejection Capacity**
   - Measure at design heat load
   - Record: inlet/outlet water temperatures, air temperatures, flow rate
   - Calculate actual heat rejection vs. design specification

2. **Condensation Prevention**
   - Verify dew point monitoring
   - Test condensation prevention controls
   - Verify supply water temperature above dew point
   - Drip tray and drain operation

3. **Leak Testing**
   - Focus on: brazed coil sections, piping connections, integrated control valves
   - Check: pressure/temperature sensor penetrations, threaded ports, O-ring seals, quick-disconnects

4. **Pressure Drop Verification**
   - Differential pressure across heat exchanger
   - Verify within manufacturer specification

---

## 3. Fire Protection Testing

### 3a. VESDA (Very Early Smoke Detection Apparatus) Testing

**Standards:** NFPA 72, manufacturer (Xtralis) Code of Practice

**System overview:** Engineered piping network draws air from protected space through laser detection chamber. Dual-stage filter removes dust/dirt.

1. **Four Alarm Levels:**
   - Alert: smoke levels above normal
   - Action: rising smoke levels, investigation required
   - Fire 1: fire condition
   - Fire 2: confirmed fire condition

2. **Commissioning Procedures:**
   - Area must be in final operating state: full room integrity, HVAC operating, floors/ceilings intact
   - Record all flow readings during commissioning for future maintenance baseline
   - Check PSU for correct signaling on power/battery loss
   - Use detector diagnostics to check for general and flow faults
   - Check all fault and alarm outputs
   - Isolate CIE/FACP to avoid generating evacuation signals during testing
   - Verify PSU and batteries
   - Verify filter life
   - Record all parameters set during commissioning

3. **Zone Mapping:**
   - Verify each sampling point corresponds to correct zone
   - Test each zone with artificial smoke
   - Verify correct zone identification at FACP and BMS

4. **Response Time:**
   - Test with calibrated smoke source at each sampling point
   - Record transport time from sampling point to detector
   - Verify within design specification

---

### 3b. Clean Agent System Testing

**Standards:** NFPA 2001 (agents: FK-5-1-12/Novec 1230, inert gases)

1. **Room Integrity / Door-Fan Test**
   - Install calibrated fan in doorway
   - Pressurize and depressurize room
   - Measure airflow and pressure differences
   - Software calculates equivalent leakage area and hold time
   - **Required hold time:** minimum 10 minutes concentration maintenance
   - Results show leakage: high level, low level, or both
   - Common failure points: above-ceiling leakage, unsealed penetrations, poor door gasketing, plenum pathways, uncontrolled HVAC openings
   - Smoke tools used to locate specific leaks
   - **Re-test frequency:** after any room modifications, or every 3-5 years

2. **Agent Quantity Verification**
   - Weigh agent cylinders
   - Compare to calculated design quantity
   - Verify per NFPA 2001 calculations

3. **Discharge Timing**
   - Verify discharge completes within design time
   - Typically <10 seconds for clean agent delivery to protected space

4. **Integration Checks**
   - Signal flow: detection → suppression → HVAC shutdown
   - Verify HVAC dampers close on suppression activation
   - Verify abort switch functionality
   - Verify pre-discharge alarm timing (typically 30-60 second delay)

---

### 3c. Pre-Action Sprinkler Testing

**Standards:** NFPA 25

**Types used in data centers:**
- Single-Interlock: detection event fills pipes; sprinkler head must also open
- Double-Interlock: both detection AND sprinkler head opening required (preferred for data centers)

1. **Annual Testing:**
   - Inspect/exercise each control valve
   - Test sprinkler alarms (flows, tampers)
   - Water flow test at both ends of system
   - Record water pressure
   - Partial trip test: valve changes state air-to-water without filling full pipe network

2. **Tri-Annual Full-Flow Trip Test:**
   - Fill entire pipe network with water
   - Record time for water to reach most remote point from riser
   - Station technician at FACP during test
   - Disconnect audible alarms for controlled test
   - Observe water discharge patterns from all open nozzles/sprinklers
   - Flow switch activation: open test valve at zone station, run water to drain
   - Verify correct message on panel display and PC monitor

---

### 3d. EPO (Emergency Power Off) Integration Testing

**Standards:** NEC Article 645.10, NEC Article 645.11

1. **Button Functionality**
   - Verify at all "approved locations readily accessible to authorized personnel and emergency responders"
   - Test shunt trip device within circuit breakers
   - Clear marking, lift-cover box with integrated alarm to prevent accidental activation

2. **Shutdown Sequencing**
   - Verify all power sources disconnected: utility, generator, UPS batteries
   - Confirm UPS battery disconnect (critical — UPS will otherwise continue on battery)
   - Test proper de-energization of IT equipment
   - Verify interaction with HVAC system

3. **Fire Alarm Integration**
   - Test EPO activation from fire alarm panel
   - Test EPO activation from BMS
   - Test manual push-button activation
   - **Best practice:** avoid auto-EPO from fire alarm to reduce false alarm risk

4. **Tier-Specific Requirements:**
   - Tier III: maintenance, isolation, or removal of EPO system without affecting critical load
   - Tier IV: fault-tolerant EPO system required
   - Consider split EPO for redundant facilities (A-side / B-side separate)

5. **Full Commissioning Test**
   - Fully test EPO with all equipment it protects during commissioning
   - Test annually thereafter
   - Verify EPO test function built into device

---

### 3e. Fire Alarm Control Panel Programming Verification

1. **Device Registration**
   - Every device proves electrical operation
   - Location verified against approved shop drawings
   - Cause & effect programming verified per specification

2. **Device Testing**
   - Each initiating device tested per manufacturer recommendations
   - Smoke detectors: artificial smoke/magnet simulation
   - Heat detectors: simulation per NFPA 72
   - Manual call points: test operational features
   - Each test witnessed to trigger correct cause & effect

3. **Output Verification**
   - Fire indication on FACP
   - Alert tones and flashers in detected area
   - Fire dampers close for detected floor
   - Package units shut down
   - Signal sent to BMS
   - Elevator recall signals verified

---

### 3f. Cause & Effect Matrix Validation

**Purpose:** Maps every input (cause) to specific outputs (effects) in fire alarm system

1. **Systematic Validation Process:**
   - For each zone/area in the matrix:
     - Activate each type of initiating device (smoke, heat, manual call point)
     - Verify ALL corresponding effects fire correctly
     - Document any discrepancies
   - Cross-check with mechanical systems: HVAC shutdown, damper closure
   - Cross-check with electrical systems: EPO activation (if configured)
   - Cross-check with suppression: clean agent release sequence

2. **Required Before IST:**
   - Baseline Cause & Effect Matrix must be completed before Systematic Integrated Testing
   - All discrepancies must be resolved before proceeding

---

## 4. BMS/DCIM Testing

### 4a. Point-to-Point Verification

1. **Analog Inputs (AI)**
   - Apply known signal to each sensor
   - Verify correct value displayed at BMS head-end
   - Check scaling and engineering units
   - Verify alarm thresholds trigger correctly
   - Examples: temperature, humidity, pressure, flow, current, voltage

2. **Digital Inputs (DI)**
   - Simulate each status condition
   - Verify correct state displayed at BMS
   - Test both normal and alarm states
   - Examples: door contacts, pump running status, breaker position

3. **Analog Outputs (AO)**
   - Command various output values from BMS
   - Verify field device responds correctly
   - Check calibration across range (0%, 25%, 50%, 75%, 100%)
   - Examples: valve position, VFD speed, damper position

4. **Digital Outputs (DO)**
   - Command on/off from BMS
   - Verify field device responds correctly
   - Test override and auto modes
   - Examples: pump start/stop, fan start/stop, lighting control

5. **Naming Convention Verification**
   - Align points lists with design documents
   - Verify naming conventions across all disciplines

---

### 4b. Alarm Testing

1. **Alarm Priority Verification**
   - Critical, Major, Minor, Informational categories
   - Each alarm assigned correct priority per design

2. **Escalation Logic**
   - First notification → acknowledgment timer → escalation
   - Verify correct escalation paths
   - Test after-hours notification routing

3. **Notification Methods**
   - Email, SMS, app notification, audio/visual
   - Test each method for each alarm priority
   - Verify correct recipient lists

4. **Simulation Method**
   - Jumper terminals in control panel to simulate alarm conditions
   - Example: jumper "Low Fuel" terminals on generator controller
   - Verify alarm shows correctly on EPMS/BMS
   - Identify: incorrect alarms, missing alarms, improperly landed sensor wires

5. **Time Synchronization**
   - Standardize time source for ALL controllers and data recorders
   - Verify alignment during dry runs
   - Skewed clocks produce misleading conclusions during transient events

---

### 4c. Trend Data Verification

1. **Data Logging Confirmation**
   - Verify all configured points are trending
   - Check sampling intervals (1 min, 5 min, 15 min per design)
   - Verify data storage capacity and retention period

2. **Data Accuracy**
   - Compare trended values to calibrated reference instruments
   - Verify no data gaps or anomalies

3. **Reporting Capability**
   - Generate sample reports for each configured template
   - Verify PUE calculation accuracy
   - Verify energy consumption aggregation

---

### 4d. Graphics/Dashboard Verification

1. **Layout Accuracy**
   - All equipment represented correctly
   - Navigation between views works properly
   - Real-time values update correctly

2. **Interactive Elements**
   - Command buttons function correctly
   - Override controls work properly
   - Alarm acknowledgment from dashboards

---

### 4e. Environmental Monitoring

1. **Temperature Monitoring**
   - Rack-inlet temperature: top, middle, bottom of each rack
   - Hot aisle / cold aisle temperature differentials
   - ASHRAE class verification (A1-A4 limits)

2. **Humidity & Dew Point**
   - Per-zone humidity monitoring
   - Dew point calculation and alarming
   - Condensation prevention alerts

3. **Differential Pressure**
   - Across contained aisles
   - Underfloor static pressure
   - Room-to-room pressure relationships

4. **Leak Detection**
   - Leak detection cable routing verification
   - Spot sensors at: condensate pans, pipe routes, mechanical areas
   - Zone isolation capability
   - BMS alarm integration

5. **Airflow Monitoring**
   - Perforated tile airflow (CFM per tile)
   - Rack airflow sensors
   - Hot aisle containment verification

---

### 4f. Energy Metering Accuracy

1. **Meter Verification**
   - Compare BMS/EPMS metering to reference instruments
   - Verify at multiple load points
   - Accuracy class verification (Class 0.2, 0.5, or 1.0 per design)

2. **PUE Calculation**
   - Total facility power / IT load power
   - Verify meter locations capture all required power paths
   - Baseline PUE established during commissioning

---

## 5. Security Systems Testing

### 5a. Access Control Testing

1. **Card Reader Testing**
   - Test each reader with authorized and unauthorized credentials
   - Verify correct access/deny response
   - Test anti-passback logic
   - Verify audit trail logging of all attempts

2. **Biometric Testing**
   - Fingerprint, iris, palm vein recognition systems
   - Enroll test users and verify acceptance
   - Test false reject rate (FRR) and false accept rate (FAR)
   - Multi-factor authentication (MFA) verification: card + biometric

3. **Mantrap Logic**
   - Verify dual-door interlocking (inner door cannot open while outer open)
   - Test weight sensor anti-tailgating
   - Test dual authentication requirement
   - Verify timeout and alarm if person stays too long

4. **Role-Based Access Control (RBAC)**
   - Test different access levels (visitor, staff, technician, admin)
   - Verify temporal restrictions (time-based access)
   - Test access revocation

5. **Integration**
   - Card/biometric readers report to central system
   - Access events logged and available for audit
   - Integration with video surveillance for event correlation

---

### 5b. CCTV Testing

1. **Camera Coverage**
   - Verify all entry/exit points covered
   - Verify critical area coverage (data hall, electrical rooms, loading docks)
   - Check for blind spots

2. **Recording Verification**
   - Confirm continuous recording at all cameras
   - Verify recording quality (resolution, frame rate)
   - Test retention period (typical 30-90 days, some up to 6 months)

3. **PTZ Control**
   - Test pan, tilt, zoom functionality
   - Verify preset positions based on events (e.g., cabinet door opening)
   - Test PTZ response to alarm triggers

4. **Video Analytics**
   - Motion detection sensitivity calibration
   - Tamper detection alerts
   - Unusual activity detection
   - Night vision / low-light performance verification

5. **Integration with Access Control**
   - Event-triggered camera views (door access → camera popup)
   - Live video monitoring during alarm conditions
   - Time-synchronized recording for event investigation

---

### 5c. Intrusion Detection Testing

1. **Door Contacts**
   - Test open/close detection at every monitored door
   - Verify alarms for doors held open past programmed time
   - Test forced-entry detection

2. **Motion Sensors**
   - PIR and microwave sensor calibration
   - Sensitivity adjustment to avoid false alarms
   - Coverage area verification

3. **Glass Break Sensors**
   - Test with calibrated glass break simulator
   - Verify detection sensitivity

4. **Alarm Routing**
   - SMS, email, app notifications to security teams
   - Centralized SOC dashboard integration
   - Response time verification

---

## 6. Network/ICT Testing

### 6a. Structured Cabling Certification

**Standards:** ANSI/TIA-568.2-D, ISO/IEC 11801, TIA-942, BICSI 002

1. **Cat6A Copper Certification (Tier 1)**
   - Equipment: Fluke DSX-8000 CableAnalyzer or equivalent
   - Parameters tested:
     - Near-End Crosstalk (NEXT)
     - Return Loss
     - Attenuation
     - Power Sum NEXT (PSNEXT)
     - Alien Crosstalk (in high-density environments)
   - Maximum length: 100 meters including patch cords
   - Results exported as PDF/XML for compliance documentation

2. **Fiber Optic Testing — Tier 1 (OLTS)**
   - Optical Loss Test Set
   - Measure insertion loss and optical return loss
   - Verify polarity
   - MPO connector cleanliness inspection

3. **Fiber Optic Testing — Tier 2 (OTDR)**
   - Optical Time Domain Reflectometer
   - Sends laser pulse and measures back-scattered light
   - Bidirectional testing required for entrance room/long runs
   - Identifies: splice quality, connector reflections, bends, breaks
   - Measures: per-splice loss, per-connector loss, fiber attenuation
   - Validates: individual element performance within the link
   - **Zone testing:**
     - Entrance room: bidirectional OTDR, splice quality, MPO polarization
     - Intermediate areas: alien crosstalk, loss, polarity
     - Equipment distribution: ToR cabling, DAC assemblies, transceiver optical power

4. **Documentation**
   - Certify cables after installation
   - Schedule annual re-certification
   - Replace damaged cables promptly
   - Store compliance certificates from commissioning

---

### 6b. Network Switch Testing

1. **Redundancy Testing**
   - Active-Active: verify load sharing, test node failure
   - Active-Passive: verify standby takeover, measure failover time
   - Protocols tested: HSRP, VRRP, GLBP
   - MLAG (Multi-Chassis Link Aggregation) verification
   - VSS/StackWise verification for stacked switches

2. **Failover Testing**
   - Disconnect primary NIC cable to trigger failover
   - Disconnect heartbeat traffic cable
   - Measure failover time (target: <15 minutes total, ideally <seconds)
   - Manual failover via clustering software
   - Verify: no packet loss, no service disruption
   - **Frequency:** at least quarterly

3. **Physical Verification**
   - Dual power supplies verified
   - Dual uplinks from rack to switch and switch to core
   - Fan operation verified
   - Verify NICs connected to different physical switches (not same switch)

---

### 6c. DNS/DHCP/NTP Verification

1. **NTP:** Verify all systems synchronized to same time source
2. **DNS:** Verify forward and reverse lookups
3. **DHCP:** Verify scope, lease times, options

---

### 6d. Out-of-Band Management Testing

1. **Verify separate management network**
2. **Test console server access**
3. **Test IPMI/iLO/iDRAC access**
4. **Verify management network segmentation from production**

---

## 7. Integrated Systems Testing (IST)

### 7a. TOAT (Total Outage Acceptance Test)

**The TOAT is the centerpiece of Level 5 IST.**

**Prerequisites (must be verified before IST):**
- All L1-L4 tests completed and signed off
- All punch list items closed (or only non-critical items remaining)
- All systems in final operating configuration
- Load banks installed and operational
- Monitoring systems recording
- Safety briefing completed
- Emergency stop procedures reviewed

**Step-by-Step TOAT Procedure:**

1. **Pre-Test Baseline** (1-2 hours)
   - Record all environmental and electrical parameters at steady state
   - Verify all monitoring systems are logging
   - Confirm load banks at target power density
   - Time-synchronize ALL recorders and controllers

2. **Utility Power Interruption** (simulate grid failure)
   - Open utility main breaker
   - **Verify:** UPS immediately supports load (0 ms transfer for online UPS)
   - **Verify:** Generator start signal sent
   - **Verify:** Generator starts within design time (typically 10 seconds)
   - **Verify:** ATS transfers to generator power
   - **Verify:** UPS recharges batteries
   - **Verify:** Cooling systems transfer to generator power
   - **Monitor:** all temperatures, voltages, currents, alarms

3. **Generator Run Under Load** (minimum 2 hours at full design load)
   - Monitor: voltage regulation, frequency stability, temperature rise
   - Verify: fuel consumption, cooling system adequacy
   - Verify: load sharing for parallel generators

4. **Generator Failure Simulation**
   - Fail primary generator (stop fuel supply or trip breaker)
   - **Verify:** backup generator takes over via ATS
   - **Verify:** UPS rides through during transfer
   - **Verify:** no temperature excursions

5. **Multiple Generator Failure** (Tier IV only)
   - Fail second generator
   - **Verify:** UPS battery supports load
   - Measure battery discharge time
   - Restore one generator before battery exhaustion

6. **Utility Restoration**
   - Re-close utility main breaker
   - **Verify:** retransfer from generator to utility (with cooldown period)
   - **Verify:** all systems return to normal automatically
   - **Verify:** all alarms clear properly

7. **Post-Test Data Review**
   - Download all monitoring data
   - Compare against acceptance criteria
   - Document any deviations

---

### 7b. Cooling Failure Simulation

1. **Single CRAH/CRAC Failure**
   - Stop one cooling unit
   - Verify remaining units compensate
   - Monitor rack inlet temperatures
   - Measure time to reach alarm thresholds

2. **Chiller Failure (pumps running)**
   - Trip one chiller
   - Verify backup chiller auto-starts
   - Thermal inertia of water loop provides buffer time
   - Monitor supply water temperature rise rate

3. **Chilled Water Pump Failure**
   - Trip one pump
   - Verify backup pump auto-starts (N+1)
   - Monitor flow rates and temperatures

4. **Complete Cooling Loss**
   - Simulate total cooling failure
   - Measure: time to critical temperature thresholds
   - Typical thermal inertia: minutes to hours depending on water volume
   - Verify: alarm sequences, notification, auto-shutdown if configured

---

### 7c. 72-Hour Heat Load / Soak Test

**Purpose:** Extended continuous operation test under simulated production load

1. **Setup**
   - Install load banks to match expected power density per rack
   - Configure cooling systems for design conditions
   - All monitoring systems active and recording

2. **72-Hour Continuous Run**
   - All systems operate under realistic load for 72 hours straight
   - Power system: utility + UPS + generators in operational mode
   - Cooling system: at design load
   - BMS/DCIM: all monitoring active
   - **During soak period, inject fault scenarios:**
     - Mains failure (at least once)
     - UPS bypass test
     - Generator failover
     - Single cooling unit loss
     - Alarm notification verification

3. **Monitoring Throughout**
   - Temperature logging devices at selected rack locations
   - Thermal imagery at regular intervals
   - Power quality logging continuous
   - All alarms recorded and investigated

4. **Acceptance Criteria**
   - All temperatures within ASHRAE limits throughout
   - No unplanned system shutdowns
   - All fault scenarios recovered automatically
   - All alarms correctly generated and notified
   - No component failures or degradation

---

### 7d. Tier III Concurrent Maintenance Test

**Purpose:** Verify any component can be maintained without affecting IT operations

**Procedure:**
1. For each critical system (power, cooling, fire, security):
   - Place one redundant path in maintenance mode
   - Verify IT operations continue unaffected
   - Perform simulated maintenance (valve closure, breaker opening, unit isolation)
   - Return to normal
   - Document: which path was isolated, duration, any impact

2. **Specific tests:**
   - Isolate one UPS module: verify remaining modules support full load
   - Isolate one generator: verify remaining generators support full load
   - Isolate one cooling unit: verify temperature stability
   - Isolate one power distribution path (A or B): verify no IT impact
   - Isolate EPO system: verify no impact to critical load (NETA requirement)

---

### 7e. Tier IV Fault Tolerance Test

**Purpose:** Verify that individual equipment failures do NOT impact IT operations

**Procedure:**
1. **Fault Injection Testing:**
   - Fail individual components WITHOUT warning (simulate actual failure)
   - Verify automatic failover with ZERO impact to IT load
   - Examples:
     - Trip one UPS: verify STS transfers seamlessly
     - Trip one generator: verify ATS transfers
     - Fail one chiller: verify backup auto-starts
     - Fail one pump: verify backup engages
     - Fail one power distribution path: verify redundant path supports

2. **Fault Isolation Testing:**
   - Simulate component failure
   - Verify fault is ISOLATED — does not cascade
   - Verify remaining systems continue at full capacity

3. **Redundant Component Load Balancing:**
   - Verify load balances across redundant components
   - Prevent overloading on failover

4. **Combined Maintenance + Fault:**
   - Place one path in maintenance
   - Simulate a fault on remaining path
   - This is the critical Tier IV test — demonstrates tolerance beyond concurrent maintainability

---

### 7f. Multiple Failure Scenario Testing

**Why:** 79% of data center outages traced to components/sequences not directly tested; 46% of backup power failures occur at integration points between components that passed standalone tests.

**Step-by-Step Sequential Failure Example:**
1. Interrupt utility power → verify Generator #1 takes over (ATS transfer)
2. Fail Generator #1 → verify Generator #2 takes over (ATS transfer)
3. Fail Generator #2 → test UPS system (battery mode)
4. Restore one generator before UPS battery depletion
5. Test each UPS separately by failing one, then the other
6. Combine power failure with cooling failure simultaneously
7. Test: utility sag during peak load + concurrent component failure

---

## 8. Commissioning Documentation

### 8a. Required Documents by Phase

**Level 0 — Design & Planning:**
- Commissioning Plan
- Owner's Project Requirements (OPR)
- Basis of Design (BOD)
- Sequence of Operation (SOO) list
- BMS Graphic Document
- BMS Points List Document
- Fire Cause & Effect Matrix
- Electrical Discrimination Study
- Arc Flash Study
- Commissioning Strategies document

**Level 1 — Factory Acceptance Testing (FAT):**
- Factory Test Reports (per equipment)
- Factory Witness Test certificates
- Equipment submittal reviews
- Non-conformance reports (if any)

**Level 2 — Delivery & Pre-Installation:**
- Delivery inspection reports
- Equipment condition on arrival
- Storage/handling records
- Pre-installation checklists (per trade)

**Level 3 — Pre-Commissioning & Startup:**
- Pre-functional/startup checklists (per system)
- Individual system test records
- Sensor calibration certificates
- Punch list items with status

**Level 4 — Functional Performance Testing:**
- Functional Performance Test Forms (FPTFs) per system
- Control sequence verification records
- Failure scenario test results
- Alarm verification records
- Load testing data and reports

**Level 5 — Integrated Systems Testing:**
- IST test scripts and procedures
- IST test results and data logs
- Thermal imaging reports
- Power quality analysis reports
- Deficiency/punch list final status
- As-built drawings
- Final commissioning report

**Level 6 — Handover/Closeout:**
- Systems Manual (operation + maintenance)
- Training Plan and completion records
- Warranty documentation
- Spare parts inventory
- Final punch list (all items closed)
- Operational readiness certification

---

### 8b. Standard Forms and Checklists

**Typical checklist categories (65+ steps across all levels):**
- Pre-installation inspection checklists
- Equipment startup checklists
- Functional performance test forms
- Sensor calibration forms
- Alarm verification forms
- Trend data verification forms
- Integration test scripts
- IST scenario scripts
- Environmental monitoring verification

**Template sources:**
- ConstructandCommission.com: 130+ editable MS Word/Excel documents
- CxPlanner: digital platform with CxAI Agents, checklists, punch lists, dashboards
- Bluerithm: Inspection Test Record templates
- SafetyCulture (iAuditor): chiller commissioning checklists

---

### 8c. Deficiency/Punch List Management

**Process:**
1. Any issue noted during testing → entered individually into punch list
2. Format agreed during Level 0
3. General Contractor responsible for closure with vendors
4. Owner's CxP must approve closure
5. **Gate rule:** ALL observations closed before advancing to next level
6. Failure during testing → retesting required on affected equipment
7. Extensive deficiencies → reschedule testing to another date

**Best Practices:**
- Track in centralized system (CxPlanner, Bluerithm, or similar)
- Clear owner and resolution plan for each item
- Regular review meetings with contractors and engineers
- Burn down to zero critical items before IST
- Do NOT start IST with serious open items

**Tagging System:**
- After L2 completion + punch closed → Yellow Tag
- After L3 completion + punch closed → Green Tag
- After L5 completion → White Tag (operational)

---

## 9. Testing Equipment Costs

### 9a. Load Bank Rental

| Capacity Range | Daily Rate | Weekly Rate | Monthly Rate |
|---|---|---|---|
| 100-500 kW | $200-$400 | $800-$1,500 | $2,500-$4,000 |
| 500-2,000 kW | $300-$600 | $1,200-$2,500 | $4,000-$8,000 |
| 2,000-3,000 kW | Quote-based | Quote-based | Quote-based |
| Per kW estimate | ~$10-$16/kW/day | — | — |

**Example project:** 48-hour rental, 800 kW, Northern Virginia: $18,000-$25,000 (incl. fuel + technician)

**Cost factors:**
- Peak season surcharge (Q4): ~30% premium
- Delivery/pick-up charges: flat or mileage-based
- Fuel surcharges
- Damage waivers / insurance
- Overtime hours
- Specialty (hydrogen-compatible): ~3x standard rates

**Major vendors:** Aggreko (100 kW to 6,250 kW), United Rentals (100-3,000 kW), Sunbelt Rentals, Rentaload (100 kW to 3.5 MW), Crestchic

---

### 9b. Power Quality Analyzer Rental

| Equipment | Weekly Rate | Notes |
|---|---|---|
| Fluke 1777 Three-Phase PQA | $350/week | Power quality + energy logging |
| Fluke 1750 Three-Phase PQR | $350/week | Power quality recorder |
| Fluke 435-II | ~$300/week | Energy analyzer |
| Megger MPQ1000 | Quote-based | Multi-phase power quality |
| AEMC Pel-103 | Quote-based | Power/energy logger |

**Vendors:** JM Test Systems, Transcat, TRS-RenTelco, United Rentals, Powersight, Lakeland Engineering

---

### 9c. Thermal Imaging Equipment Rental

| Equipment | Daily Rate | Weekly Rate | Monthly Rate |
|---|---|---|---|
| Basic thermal camera | $35-$75 | $200-$400 | $600-$1,000 |
| Mid-range (FLIR E-series, Fluke Ti) | $75-$150 | $400-$800 | $1,200-$2,500 |
| High-end (FLIR T-series) | $100-$200 | $500-$800 | $1,500-$3,000 |
| FLIR TG267 | $75/day | — | — |
| Peer-to-peer rental (basic) | ~$19/day | ~$66/week | — |

**Vendors:** JM Test Systems, Transcat, TRS-RenTelco, Home Depot (1,200+ locations), FLIR direct, Global Test Supply

---

### 9d. Insulation Resistance Tester (Megger) Rental

| Equipment | Weekly Rate | Notes |
|---|---|---|
| Megger MIT1025 (10 kV) | $250/week | Diagnostic + maintenance testing |
| Megger MIT1525 (15 kV) | Quote-based | Higher voltage capability |
| Smaller megohmmeter models | From $175/week | Lower voltage ratings |

**Vendors:** BHD TM, Transcat, Electro Rent, JM Test Systems, Global Test Supply, Megger direct rental

---

### 9e. Low Resistance Ohmmeter (DLRO) Rental

| Equipment | Weekly Rate | Notes |
|---|---|---|
| Megger DLRO200 | $210/week | 0.1 uOhm to 1 Ohm range, high current |
| Megger DLRO10HD | $160/week | 10A, dual power |

---

### 9f. Vibration Analysis Equipment Rental

| Equipment | Weekly Rate (approx.) | Notes |
|---|---|---|
| Svantek SV803 Wireless | ~$300/week (£235) | Wireless vibration monitor |
| Instantel Minimate Plus | ~$275/week (£214.50) | Advanced vibration/seismograph |
| Fluke vibration meters | Quote-based | Various models |
| Echo Wireless System | Quote-based | Remote machinery health monitoring |

**Vendors:** JM Test Systems, The Modal Shop, Transcat, Sunbelt/Inlec, ATEC, Scantek

---

### 9g. Cable Testing/Certification Equipment

| Equipment | Notes |
|---|---|
| Fluke DSX-8000 CableAnalyzer | Copper Cat6A/Cat8 certification; also supports fiber with modules |
| EXFO MaxTester | Hybrid copper/fiber with Tier 2 OTDR |
| AEM TestPro CV100 | Single-ended certification + PoE testing |

*Note: Cable certification equipment is typically purchased or provided by the cabling contractor. Rental is available through specialty test equipment providers.*

---

### 9h. Estimated Total Equipment Costs for Commissioning

**For a typical 2 MW data center, 4-6 week commissioning period:**

| Equipment Category | Estimated Cost Range |
|---|---|
| Load banks (2 MW capacity, 4-6 weeks) | $40,000-$80,000 |
| Power quality analyzers (2 units, 4 weeks) | $2,800-$5,000 |
| Thermal imaging cameras (2 units, 4 weeks) | $4,800-$10,000 |
| Insulation testers/megohmmeters (4 weeks) | $1,000-$2,000 |
| Low resistance ohmmeters (2 weeks) | $320-$420 |
| Vibration analysis (2 weeks) | $600-$1,200 |
| Cable certification (included in cabling contract) | $0 (included) |
| Miscellaneous test equipment | $2,000-$5,000 |
| **Delivery, setup, fuel** | **$10,000-$25,000** |
| **TOTAL EQUIPMENT** | **$61,520-$128,620** |

*Note: These are equipment rental costs only. Does not include commissioning personnel, engineering, or project management costs. Costs scale roughly linearly with MW capacity. Hyperscale facilities (>10 MW) may negotiate volume discounts of 10-20%.*

---

## Sources

### Electrical Testing
- [Switchgear Inspection & Test Procedure (ResearchGate)](https://www.researchgate.net/profile/Ramadan-Ali-5/publication/336373968_MV_SWITCHGEAR_INSPECTION_AND_TEST_PROCEDURE/links/5d9ed39292851cce3c912490/MV-SWITCHGEAR-INSPECTION-AND-TEST-PROCEDURE.pdf)
- [TestGuy — Switchgear Testing Guide](https://wiki.testguy.net/t/switchgear-and-switchboard-inspection-and-testing-guide/89)
- [EEP — Tests for MV Switchgear](https://electrical-engineering-portal.com/tests-medium-voltage-metal-enclosed-switchgear)
- [Paktechpoint — MV Switchgear Testing Procedure](https://paktechpoint.com/medium-voltage-switchgear-testing-procedure-method-statement/)
- [EEP — Transformer Testing & Commissioning](https://electrical-engineering-portal.com/power-transformers-testing-commissioning-at-site)
- [EEP — Transformer Pre-Commissioning Tests](https://electrical-engineering-portal.com/transformer-pre-commissioning-tests)
- [Electrical4U — Winding Resistance Test](https://www.electrical4u.com/transformer-winding-resistance-measurement/)
- [TestGuy — Winding Resistance Methods](https://wiki.testguy.net/t/transformer-winding-resistance-test-methods-and-procedures-explained/81)
- [Maddox — DGA Guide](https://www.maddox.com/resources/articles/transformer-maintenance-dissolved-gas-analysis-and-how-to-pull-an-oil-sample)
- [Electrical4U — Temperature Rise Test](https://www.electrical4u.com/transformer-oil-and-winding-temperature-rise-test/)
- [NETA ATS-2025 (ANSI Blog)](https://blog.ansi.org/ansi/ansi-neta-ats-2025-electrical-power-testing/)
- [TestGuy — Insulation Resistance Values](https://forum.testguy.net/content/240-Insulation-Resistance-Test-Values)
- [Schneider Electric — Contact Resistance Testing](https://www.productinfo.schneider-electric.com/0600db1901resistancetesting/0600db1901/0600DB1901%20Circuit%20Breaker%20Contact%20Resistance%20Testing%20Data%20Bulletin/en/0600DB1901%20(bookmap)_0000356373.xml/$/IndustryStandards-6A1577D9)
- [NETA World — Circuit Breaker Timing](https://netaworldjournal.org/2024/08/paulgreincbs/cover-story/circuit-breaker-timing-and-time-travel-analysis-testing-the-what-how-when-why-and-where/)

### UPS & Generator Testing
- [EC&M — How to Maintain & Test UPS](https://www.ecmweb.com/content/article/20888675/how-to-maintain-and-test-ups-systems)
- [PureSine — UPS Commissioning](https://puresine.co.uk/ups-commissioning-testing/)
- [CxPlanner — UPS & Generator Testing](https://cxplanner.com/data-centers/resources/data-centers-test-ups-generator)
- [JC Davis Power — Load Bank Testing Guide](https://www.jcdavispower.com/understanding-generator-load-banks-testing-and-commissioning-best-practices/)
- [Crestchic — Data Centers Load Testing 2026](https://loadbanks.com/data-centres-load-testing-and-power-resilience-in-2026/)
- [Aggreko — Load Bank Commissioning](https://www.aggreko.com/en-us/blogs/data-centers/load-bank-testing-and-commissioning-key-to-data-center-performance)
- [Power Electrics — Black Start Testing](https://powerelectrics.com/blog/what-is-black-start-testing/)
- [CX Associates — Emergency Power Testing](https://buildingenergy.cx-associates.com/2014/12/testing-an-emergency-power-system-for-a-data-center/)

### ATS/STS
- [Caeled — ATS vs STS Guide 2025](https://www.caeled.com/blog/data-center-lighting/data-center-autoswitching-systems-ats-vs-sts-vs-mvats-performance-standards-design-guide-2025/)
- [VIOX — Open vs Closed Transition ATS](https://viox.com/open-vs-closed-transition-ats-selection-guide/)
- [DataCenterSS — STS vs ATS Guide](https://datacenterss.com/key-differences-between-sts-and-ats-a-practical-guide-for-data-centers/)

### Mechanical Systems
- [ConstructandCommission — Heat Load Testing Guide](https://constructandcommission.com/hlt-data-hall-heat-load-testing-a-comprehensive-guide/)
- [ChemTreat — Sustainable Cooling for Data Centers](https://chemtreat.com/a-practical-guide-to-sustainable-cooling-practices-for-data-centers)
- [CXP Solutions — Cooling System Cleaning](https://cxp-solutions.com/services/data-center-cooling-service-page/)
- [CSE Mag — Water Treatment Best Practices](https://www.csemag.com/best-practices-for-water-treatment-in-data-center-cooling/)
- [OCP — Pre-Commission TCS Guidelines](https://www.opencompute.org/documents/ocp-document-submission-guidelines-for-pre-commission-preparation-of-technology-cooling-system-tcs-row-manifolds-revq-pdf-1)
- [ConstructandCommission — CRAC Functional Testing](https://constructandcommission.com/crac-unit-functional-testing-template/)
- [ConstructandCommission — Cooling Tower Piping](https://constructandcommission.com/cooling-tower-piping-layout-and-diagrams/)

### Liquid Cooling
- [IoThrifty — Coolant Flow Monitoring](https://www.iothrifty.com/blogs/news/monitoring-coolant-flow-in-high-density-liquid-cooled-data-centers)
- [DCD — Direct Liquid Cooling Challenges (WP210)](https://media.datacenterdynamics.com/media/documents/WP210_V1_EN.pdf)
- [CSE Mag — Piping for Liquid Cooling](https://www.csemag.com/how-to-design-piping-systems-for-data-centers-that-require-liquid-cooling/)
- [Quality Magazine — Leak Testing for Data Centers](https://www.qualitymag.com/articles/99290-ensuring-reliability-in-data-centers-the-evolving-role-of-leak-testing)
- [Cincinnati Test — DC Cooling Leak Testing](https://www.cincinnati-test.com/data-center-cooling-leak-testing)
- [SwRI — Data Center Cooling Testing](https://www.swri.org/markets/energy-environment/fluids-engineering/data-center-cooling-testing-research)

### Fire Protection
- [Xtralis — FIA Code of Practice](https://xtralis.com/file/7504)
- [BlueBMS — Data Center Fire Protection 2025](https://bluebms.com/data-center-fire-protection-nfpa-75-2001-tia-942-abnt-nbr-17240-10897/)
- [JLab — VESDA Testing Procedure](https://www.jlab.org/ehs/ehsmanual/Fire/Ch4App9.htm)
- [SSI — Clean Agent Room Sealing](https://www.suppressionsystems.com/proper-sealing-of-clean-agent-rooms/)
- [Ventro Group — Why Cause & Effect Matrix Essential](https://www.ventrogroup.com/blog/why-cause-and-effect-matrix-is-essential)
- [JLab — Pre-Action Full Flow Trip Test](https://www.jlab.org/ehs/ehsmanual/Fire/Ch4App11.htm)
- [F-T.com — EPO in Data Centers](https://www.f-t.com/post/emergency-power-off-in-data-centers)
- [PLANNET — EPO Best Practices](https://plannet.com/dont-let-the-epo-take-you-down/)

### BMS/DCIM
- [OPAL-RT — 7 Key Steps for DC Commissioning](https://www.opal-rt.com/blog/7-key-steps-for-data-center-commissioning-and-testing/)
- [TechSitePlan — Commissioning Hyperscale DCs](https://techsiteplan.com/commissioning-critical-systems-in-hyperscale-data-centers/)
- [Eaton — EPMS FAQ](https://www.eaton.com/us/en-us/digital/brightlayer/brightlayer-data-centers-suite/eaton-epms/epms-standard/electrical-power-monitoring-system-faq.html)
- [Hatch Power — EPMS in Data Centers](https://www.hatchpower.com/posts/epms-in-data-centers)
- [ENCOR Advisors — Environmental Monitoring Guide](https://encoradvisors.com/data-center-environmental-monitoring/)

### Security
- [ENCOR Advisors — Physical Security Guide 2025](https://encoradvisors.com/data-center-physical-security/)
- [ISA — Physical Security of a Data Center](https://gca.isa.org/blog/physical-security-of-a-data-center)
- [Microsoft — Datacenter Physical Access Security](https://learn.microsoft.com/en-us/compliance/assurance/assurance-datacenter-physical-access-security)

### Network/ICT
- [Caeled — Data Center Cabling Best Practices 2025](https://www.caeled.com/blog/data-center-lighting/data-center-cabling-best-practices-2025-standards-design-methods-and-proven-deployment-strategies/)
- [TriTech — Cable Testing & Certification](https://www.tritechcoa.com/post/network-cable-testing)
- [Data Center Frontier — Fiber Certification](https://www.datacenterfrontier.com/sponsored/article/33036420/certification-of-fiber-optic-cabling-crucial-for-new-data-centers)
- [TechTarget — Failover Testing](https://www.techtarget.com/searchdatacenter/tip/Safer-failover-testing-procedures-for-the-data-center)

### IST & Commissioning Levels
- [CxPlanner — Integrated Systems Testing](https://cxplanner.com/commissioning-101/integrated-system-testing)
- [ConstructandCommission — Level 5 IST Guide](https://constructandcommission.com/level-5-data-center-commissioning-step-by-step-guide/)
- [HorizonIQ — IST for Data Centers](https://www.horizoniq.com/blog/integrated-systems-testing-for-data-centers/)
- [ConstructandCommission — 5 Levels of Commissioning](https://constructandcommission.com/5-levels-of-commissioning-explained-data-center/)
- [Crestchic — IST in Data Centers](https://loadbanks.com/what-is-integrated-systems-testing-in-a-data-centre-environment/)
- [ErVo-Commissioning — TOAT](https://ervo-commissioning.nl/?page_id=422)
- [Uptime Institute — Tier Classification](https://uptimeinstitute.com/tiers)
- [CxPlanner — Uptime Tier & Commissioning](https://cxplanner.com/data-centers/resources/data-centers-uptime-tier)

### Documentation & Templates
- [ConstructandCommission — Commissioning Checklist](https://constructandcommission.com/data-center-commissioning-checklist/)
- [ConstructandCommission — Commissioning Guideline & Template](https://constructandcommission.com/data-center-commissioning-guideline-template/)
- [Archilabs — Pre-IST Checklist for Owners](https://archilabs.ai/posts/data-center-commissioning-checklist-for-owners-pre-ist)
- [Bluerithm — Guide to DC Commissioning](https://bluerithm.com/guide-to-data-center-commissioning/)
- [PingCx — When Failure Is Not an Option](https://www.pingcx.com/blog/data-center-commissioning-when-failure-is-not-an-option)

### Equipment Costs
- [PMarket Research — Load Bank Rental Market](https://pmarketresearch.com/chemi/high-voltage-unshielded-cable-market/load-bank-rental-for-data-centers-market)
- [Aggreko — Load Bank Rental](https://www.aggreko.com/en-us/products/load-banks)
- [Rentaload — Load Bank Rental](https://rentaload.com/en/)
- [JM Test Systems — Power Quality Analyzer Rental](https://jmtest.com/c/rental/rent-electrical-test-equipment/rent-power-datalogging-analysis/rent-power-quality-analyzer/)
- [Transcat — Power Analyzer Rental](https://www.transcat.com/rental-equipment/power-quality-analyzer-rental)
- [JM Test Systems — Thermal Camera Rental](https://jmtest.com/c/rental/rent-electrical-test-equipment/thermal-imaging-camera-rental/)
- [BHD TM — Megger Rental](https://bhdtm.com/products/megger-mit1025-10kv-insulation-tester-rental)
- [Fluke — Thermal Imaging in Data Centers](https://www.fluke.com/en-us/learn/blog/thermal-imaging/using-thermal-imaging-in-data-centers)
- [HIOKI — Data Center Commissioning Levels](https://www.hioki.com/us-en/industries-solutions/facilities/data-center-commissioning-levels.html)

### Failure Statistics
- [OPAL-RT — Mitigating Risk with HIL Testing](https://www.opal-rt.com/blog/mitigating-risk-in-data-center-commissioning-with-hil-testing/)
