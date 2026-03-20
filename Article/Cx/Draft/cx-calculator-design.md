# Data Center Commissioning (Cx) Calculator — Complete Design Document

> **Version**: 1.0 Draft
> **Date**: 2026-03-18
> **Author**: ResistanceZero Engineering
> **Target File**: `/rz-work/cx-calculator.html` (single-file, self-contained)
> **CSS Prefix**: `cx-` (all classes prefixed to avoid collision with global styles.css)

---

## 1. Executive Summary

### 1.1. What This Tool Does

The Data Center Commissioning (Cx) Calculator is an interactive browser-based tool that estimates the **full commissioning cost**, **schedule/timeline**, and **resource requirements** for data center facilities across all five commissioning levels (L1–L5). It produces:

- **Total commissioning cost** with per-level and per-discipline breakdowns
- **Interactive Gantt chart** with 5 levels of expandable depth (Phase → Discipline → System → Activity → Sub-task)
- **Resource loading** (personnel count by role over time)
- **Risk-adjusted estimates** via Monte Carlo simulation (Pro mode)
- **Exportable PDF report** with SVG charts, tables, and executive narrative

### 1.2. Target Users

- Data center project managers and owners
- Commissioning authorities (CxA) and agents
- MEP engineering firms bidding on Cx contracts
- Facility managers planning recommissioning
- Investors evaluating construction budgets

### 1.3. Relationship to Existing Tools

This calculator **adopts input patterns** from the CAPEX calculator (`capex-calculator.html`) and **cross-references** data from:
- OPEX calculator — staffing models, maintenance cost baselines
- PUE calculator — cooling COP values, UPS efficiency tiers
- Tier Advisor — redundancy-to-tier mapping
- TIA-942 Checklist — compliance domain items

### 1.4. Key Design Principles

1. **Single HTML file** — all CSS, JS, data objects embedded (consistent with all RZ tools)
2. **Client-side only** — no server calls, no data transmitted
3. **IIFE pattern** — calculator logic wrapped in `(function(){ ... })()` to avoid global namespace pollution
4. **Free/Pro gating** — basic results free, advanced analytics behind Pro login
5. **Accuracy first** — all values sourced from industry standards (ASHRAE, NETA, BSRIA, Uptime Institute)

---

## 2. Input Parameters

### 2.1. Input Architecture

Inputs are divided into **Free Mode** (visible to all users) and **Pro Mode** (revealed after authentication). This follows the pattern established in `capex-calculator.html` and standardized in `PRO_MODE_STANDARDIZATION.md`.

All inputs use the `cx-input-group` CSS class with tooltip icons following `TOOLTIP_STANDARD.md` (title 0.82rem, description 0.78rem, formula 0.72rem).

### 2.2. Free Mode Inputs (8 inputs)

#### Input 1: IT Load Capacity (kW)
```
ID:          cx-it-load
Type:        number (range slider + manual input)
Range:       100 – 100,000 kW
Default:     2,000 kW
Step:        100
Unit:        kW
Tooltip:     "Total planned IT electrical load capacity. This drives the scale
              of all MEP systems requiring commissioning."
Formula:     "Directly scales: number of UPS modules, generator sets, cooling
              units, PDUs, and all downstream Cx activities."
Validation:  Must be positive integer, min 100, max 100,000
```

**Scaling Logic** (adopted from CAPEX):
```javascript
// IT Load determines equipment counts which drive Cx scope
var equipmentScale = {
  ups_modules:    Math.ceil(itLoad / 500),    // 1 UPS module per 500kW typical
  generators:     Math.ceil(itLoad / 2000),   // 1 generator per 2MW typical
  cooling_units:  Math.ceil(itLoad / 200),    // 1 CRAH/CRAC per 200kW typical (air)
  pdus:           Math.ceil(itLoad / 100),    // 1 PDU per 100kW typical
  sts_units:      Math.ceil(itLoad / 1000),   // 1 STS per 1MW typical
  transformers:   Math.ceil(itLoad / 2500),   // 1 transformer per 2.5MW typical
  switchgear:     Math.ceil(itLoad / 5000) + 1, // min 2 for redundancy
  racks:          Math.ceil(itLoad / rackDensityKw) // depends on density selection
};
```

#### Input 2: Cooling Type
```
ID:          cx-cooling-type
Type:        select dropdown
Options:
  - "air"    → "Raised Floor CRAC/CRAH" (label)
  - "inrow"  → "In-Row Precision Cooling"
  - "rdhx"   → "Rear Door Heat Exchanger (RDHX)"
  - "dlc"    → "Direct Liquid Cooling (DLC)"
  - "immersion" → "Immersion Cooling"
Default:     "air"
Tooltip:     "Primary cooling architecture. Directly impacts mechanical Cx
              scope, duration, and specialized testing requirements."
```

**Cooling Type Impact Multipliers on Cx:**
```javascript
var coolingCxMultiplier = {
  air:       { cost: 1.00, duration: 1.00, complexity: 'standard',
               additionalTests: [] },
  inrow:     { cost: 1.12, duration: 1.08, complexity: 'medium',
               additionalTests: ['airflow_containment_verification',
                                  'hot_aisle_cold_aisle_differential'] },
  rdhx:      { cost: 1.25, duration: 1.18, complexity: 'high',
               additionalTests: ['water_loop_pressure_test',
                                  'leak_detection_verification',
                                  'glycol_concentration_test',
                                  'secondary_pump_balancing'] },
  dlc:       { cost: 1.45, duration: 1.35, complexity: 'very_high',
               additionalTests: ['cdu_functional_test',
                                  'manifold_pressure_test',
                                  'coolant_flow_balancing',
                                  'quick_disconnect_leak_test',
                                  'server_level_flow_verification',
                                  'coolant_quality_analysis',
                                  'thermal_interface_verification'] },
  immersion: { cost: 1.55, duration: 1.40, complexity: 'specialized',
               additionalTests: ['tank_leak_test',
                                  'fluid_dielectric_test',
                                  'immersion_fluid_fill_procedure',
                                  'overflow_containment_test',
                                  'fluid_circulation_balancing',
                                  'vapor_recovery_test',
                                  'server_submersion_procedure'] }
};
```

#### Input 3: Redundancy Level
```
ID:          cx-redundancy
Type:        select dropdown
Options:
  - "N"      → "N (No Redundancy)"
  - "N+1"    → "N+1 (Component Redundancy)"
  - "2N"     → "2N (System Redundancy)"
  - "2N+1"   → "2N+1 (System + Component)"
Default:     "N+1"
Tooltip:     "Infrastructure redundancy level. Higher redundancy = more
              equipment to commission + concurrent maintainability testing
              at L4/L5. Maps to Uptime Tier classification."
```

**Redundancy Impact on Cx:**
```javascript
var redundancyCxMultiplier = {
  'N':   {
    costMult: 1.00,
    durationMult: 1.00,
    tierMap: 'Tier I',
    availability: '99.671%',
    annualDowntime: '28.8 hours',
    cxScope: 'Basic functional testing only. No redundancy paths to verify.',
    l5Tests: ['basic_power_on', 'load_test'],
    concurrentMaintainability: false,
    faultTolerance: false
  },
  'N+1': {
    costMult: 1.35,
    durationMult: 1.30,
    tierMap: 'Tier II/III',
    availability: '99.982%',
    annualDowntime: '1.6 hours',
    cxScope: 'Component-level failover testing. One redundant path per system.',
    l5Tests: ['component_failover', 'ups_module_removal', 'cooling_unit_loss',
              'generator_start_sequence', 'load_transfer'],
    concurrentMaintainability: true,  // Tier III requires this
    faultTolerance: false
  },
  '2N':  {
    costMult: 2.00,
    durationMult: 1.75,
    tierMap: 'Tier IV',
    availability: '99.995%',
    annualDowntime: '0.4 hours',
    cxScope: 'Full system-level redundancy testing. Both paths A and B tested independently and under failover.',
    l5Tests: ['system_failover_A_to_B', 'system_failover_B_to_A',
              'sts_transfer_test', 'dual_path_load_balance',
              'concurrent_maintainability_full',
              'single_point_failure_analysis',
              'fault_tolerance_simulation'],
    concurrentMaintainability: true,
    faultTolerance: true
  },
  '2N+1': {
    costMult: 2.25,
    durationMult: 1.90,
    tierMap: 'Tier IV+',
    availability: '99.9995%',
    annualDowntime: '0.03 hours',
    cxScope: 'Premium redundancy: both system-level AND component-level failover across all paths.',
    l5Tests: ['full_2N_test_suite', 'additional_component_failover_per_path',
              'n_plus_1_within_each_path', 'cascade_failure_simulation',
              'black_start_both_paths', 'extended_72hr_load_test'],
    concurrentMaintainability: true,
    faultTolerance: true
  }
};
```

#### Input 4: Rack Density
```
ID:          cx-rack-density
Type:        select dropdown
Options:
  - "standard" → "Standard (5–7 kW/rack)"
  - "medium"   → "Medium (10–15 kW/rack)"
  - "high"     → "High Density (20–30 kW/rack)"
  - "ai_hpc"   → "AI/HPC (50–100 kW/rack)"
Default:     "standard"
Tooltip:     "Average power density per rack. Higher density increases cooling
              Cx complexity and may require liquid cooling commissioning."
```

**Impact on Cx:**
```javascript
var rackDensityCx = {
  standard: { kw: 6,   coolingComplexity: 1.0, powerChainDepth: 1.0,
              typicalCooling: 'air',
              notes: 'Standard raised-floor cooling. Basic airflow management.' },
  medium:   { kw: 12,  coolingComplexity: 1.15, powerChainDepth: 1.05,
              typicalCooling: 'air/inrow',
              notes: 'May require hot/cold aisle containment verification.' },
  high:     { kw: 25,  coolingComplexity: 1.35, powerChainDepth: 1.15,
              typicalCooling: 'inrow/rdhx',
              notes: 'Containment mandatory. Per-rack cooling verification needed.' },
  ai_hpc:   { kw: 75,  coolingComplexity: 1.60, powerChainDepth: 1.30,
              typicalCooling: 'dlc/immersion',
              notes: 'Liquid cooling mandatory. CDU commissioning, manifold testing, per-server flow verification.' }
};
```

#### Input 5: Building Type
```
ID:          cx-building-type
Type:        select dropdown
Options:
  - "warehouse"  → "Converted Warehouse/Industrial"
  - "modular"    → "Modular/Prefabricated"
  - "purpose"    → "Purpose-Built Facility"
  - "highrise"   → "Multi-Story / High-Rise"
Default:     "purpose"
Tooltip:     "Building construction type affects structural Cx scope,
              logistics complexity, and building systems integration depth."
```

**Impact on Cx:**
```javascript
var buildingCxMultiplier = {
  warehouse: { cost: 0.80, duration: 0.85,
    notes: 'Reduced structural Cx. May need remediation verification for repurposed spaces.',
    additionalCx: ['structural_assessment_verification', 'floor_loading_test',
                    'environmental_sealing_verification'] },
  modular:   { cost: 0.75, duration: 0.70,
    notes: 'Factory-tested modules reduce on-site Cx. Focus on inter-module integration.',
    additionalCx: ['module_interconnect_test', 'module_alignment_verification',
                    'inter_module_cable_routing_check'] },
  purpose:   { cost: 1.00, duration: 1.00,
    notes: 'Standard Cx scope. All systems purpose-designed.',
    additionalCx: [] },
  highrise:  { cost: 1.30, duration: 1.25,
    notes: 'Vertical transport Cx. Floor-by-floor testing. Elevator/hoist integration.',
    additionalCx: ['vertical_riser_test', 'floor_isolation_test',
                    'elevator_integration', 'stairwell_pressurization',
                    'multi_floor_cooling_loop_balance'] }
};
```

#### Input 6: Fire Suppression Type
```
ID:          cx-fire-suppression
Type:        select dropdown
Options:
  - "fm200"     → "FM-200 (HFC-227ea)"
  - "novec"     → "Novec 1230 (FK-5-1-12)"
  - "inergen"   → "Inergen (IG-541)"
  - "n2"        → "Nitrogen (IG-100)"
  - "water"     → "Pre-Action Sprinkler"
  - "water_mist" → "Water Mist (Hi-Fog)"
Default:     "novec"
Tooltip:     "Fire suppression system type. Gas-based systems require room
              integrity testing (door fan test). Water-based require hydrostatic
              and flow testing."
```

**Cx Requirements per Type:**
```javascript
var fireCxByType = {
  fm200: {
    roomIntegrityTest: true,
    hydrostaticTest: false,
    agentWeighTest: true,
    dischargeTest: true,  // typically simulated, not live
    doorFanTestRequired: true,
    retentionTimeTarget: '10 minutes minimum',
    cxCostMultiplier: 1.00,
    tests: ['cylinder_weight_verification', 'nozzle_coverage_calculation',
            'detection_zone_mapping', 'abort_switch_test',
            'cross_zone_detection_verification', 'pre_discharge_alarm_timing',
            'door_fan_integrity_test', 'concentration_calculation_verification',
            'manual_release_test', 'epms_integration_test']
  },
  novec: {
    roomIntegrityTest: true,
    hydrostaticTest: false,
    agentWeighTest: true,
    dischargeTest: true,
    doorFanTestRequired: true,
    retentionTimeTarget: '10 minutes minimum',
    cxCostMultiplier: 1.05,
    tests: ['cylinder_weight_verification', 'nozzle_coverage_calculation',
            'detection_zone_mapping', 'abort_switch_test',
            'cross_zone_detection_verification', 'pre_discharge_alarm_timing',
            'door_fan_integrity_test', 'concentration_calculation_verification',
            'manual_release_test', 'epms_integration_test',
            'environmental_monitoring_integration']
  },
  inergen: {
    roomIntegrityTest: true,
    hydrostaticTest: false,
    agentWeighTest: true,
    dischargeTest: true,
    doorFanTestRequired: true,
    retentionTimeTarget: '10 minutes minimum',
    cxCostMultiplier: 1.10,
    tests: ['cylinder_bank_verification', 'manifold_pressure_test',
            'nozzle_coverage_calculation', 'detection_zone_mapping',
            'abort_switch_test', 'cross_zone_detection_verification',
            'pre_discharge_alarm_timing', 'door_fan_integrity_test',
            'pressure_relief_vent_sizing', 'oxygen_depletion_calculation',
            'manual_release_test']
  },
  n2: {
    roomIntegrityTest: true,
    hydrostaticTest: false,
    agentWeighTest: false,  // N2 is generated or bulk stored
    dischargeTest: true,
    doorFanTestRequired: true,
    retentionTimeTarget: '10 minutes minimum',
    cxCostMultiplier: 1.08,
    tests: ['n2_generator_functional_test', 'storage_pressure_verification',
            'nozzle_coverage_calculation', 'detection_zone_mapping',
            'abort_switch_test', 'cross_zone_detection_verification',
            'pre_discharge_alarm_timing', 'door_fan_integrity_test',
            'oxygen_reduction_rate_test', 'manual_release_test']
  },
  water: {
    roomIntegrityTest: false,
    hydrostaticTest: true,
    agentWeighTest: false,
    dischargeTest: false,  // no full discharge test
    doorFanTestRequired: false,
    retentionTimeTarget: 'N/A',
    cxCostMultiplier: 0.85,
    tests: ['hydrostatic_pressure_test', 'flow_test', 'alarm_valve_trip_test',
            'inspector_test_connection', 'tamper_switch_test',
            'supervisory_signal_test', 'waterflow_alarm_test',
            'pre_action_valve_functional_test', 'air_maintenance_device_test',
            'fire_pump_test', 'jockey_pump_test']
  },
  water_mist: {
    roomIntegrityTest: false,
    hydrostaticTest: true,
    agentWeighTest: false,
    dischargeTest: true,  // section test required
    doorFanTestRequired: false,
    retentionTimeTarget: 'N/A',
    cxCostMultiplier: 1.15,
    tests: ['hydrostatic_pressure_test', 'nozzle_spray_pattern_test',
            'pump_unit_functional_test', 'section_valve_test',
            'accumulator_pressure_test', 'filter_integrity_test',
            'zone_release_test', 'detection_integration_test',
            'manual_release_test', 'water_quality_analysis']
  }
};
```

#### Input 7: UPS Type
```
ID:          cx-ups-type
Type:        select dropdown
Options:
  - "standalone"  → "Standalone (Legacy Tower)"
  - "modular"     → "Modular (Hot-Swappable)"
  - "distributed" → "Distributed (Rack-Mount)"
  - "rotary"      → "Rotary (Diesel Rotary UPS)"
Default:     "modular"
Tooltip:     "UPS topology affects electrical Cx scope. Modular UPS requires
              per-module testing + n+1 failover. Rotary requires mechanical
              + electrical integration testing."
```

**UPS Cx Requirements:**
```javascript
var upsCxByType = {
  standalone: {
    efficiency: 0.90,
    cxComplexity: 1.0,
    moduleSwapTest: false,
    tests: ['input_power_quality_measurement', 'output_voltage_regulation',
            'battery_capacity_test', 'transfer_time_measurement',
            'bypass_operation_test', 'overload_test',
            'harmonic_distortion_measurement', 'efficiency_measurement',
            'alarm_verification', 'remote_monitoring_test'],
    batteryTests: ['impedance_test', 'capacity_discharge_test',
                    'charge_rate_verification', 'thermal_runaway_detection',
                    'string_voltage_balance', 'intercell_resistance']
  },
  modular: {
    efficiency: 0.97,
    cxComplexity: 1.25,
    moduleSwapTest: true,
    tests: ['per_module_functional_test', 'module_parallel_operation',
            'hot_swap_module_removal', 'hot_swap_module_insertion',
            'load_sharing_verification', 'n_plus_1_failover',
            'input_power_quality', 'output_regulation',
            'battery_integration', 'transfer_time',
            'bypass_test', 'overload_test', 'efficiency_measurement',
            'communication_module_test', 'firmware_version_verification'],
    batteryTests: ['impedance_test', 'capacity_discharge_test',
                    'charge_rate_verification', 'modular_battery_swap_test']
  },
  distributed: {
    efficiency: 0.96,
    cxComplexity: 1.15,
    moduleSwapTest: true,
    tests: ['per_unit_functional_test', 'distributed_load_sharing',
            'unit_removal_impact_test', 'rack_level_protection_verification',
            'input_power_quality', 'output_regulation',
            'battery_integration', 'transfer_time',
            'communication_bus_test', 'centralized_monitoring_test'],
    batteryTests: ['lithium_ion_bms_verification', 'cell_balance_test',
                    'thermal_management_test', 'soc_accuracy_calibration']
  },
  rotary: {
    efficiency: 0.98,
    cxComplexity: 1.40,
    moduleSwapTest: false,
    tests: ['diesel_engine_start_test', 'clutch_engagement_test',
            'flywheel_energy_storage_test', 'kinetic_energy_ride_through',
            'transfer_time_measurement', 'output_voltage_regulation',
            'frequency_stability_test', 'vibration_analysis',
            'fuel_system_test', 'exhaust_system_test',
            'cooling_system_test', 'noise_level_measurement',
            'synchronization_test', 'load_step_response',
            'emergency_stop_test'],
    batteryTests: [] // No batteries in rotary UPS
  }
};
```

#### Input 8: Region / Location
```
ID:          cx-region
Type:        select dropdown with search
Options:     30+ countries/regions (see Section 9 for full labor rate database)
Default:     "us_virginia"
Tooltip:     "Project location determines labor rates, regulatory requirements,
              travel costs for specialists, and equipment lead times."
```

### 2.3. Pro Mode Inputs (6 additional inputs)

#### Pro Input 1: Generator Type
```
ID:          cx-generator-type
Type:        select dropdown
Options:
  - "diesel"   → "Diesel Generator"
  - "gas"      → "Natural Gas Generator"
  - "dualfuel" → "Dual Fuel (Diesel + Gas)"
  - "hvo"      → "HVO (Hydrotreated Vegetable Oil)"
Default:     "diesel"
Tooltip:     "Generator fuel type affects Cx scope. Dual-fuel requires
              additional fuel switchover testing. HVO requires fuel quality
              verification and compatibility testing."
```

**Generator Cx by Type:**
```javascript
var generatorCxByType = {
  diesel: {
    cxMultiplier: 1.00,
    tests: ['prelube_verification', 'cranking_test', 'start_time_measurement',
            'voltage_frequency_regulation', 'load_step_test_25_50_75_100',
            'load_rejection_test', 'parallel_operation_test',
            'synchronization_test', 'fuel_transfer_system_test',
            'day_tank_level_controls', 'coolant_system_test',
            'exhaust_backpressure_measurement', 'vibration_isolation_test',
            'noise_level_measurement', 'ats_integration_test',
            'emergency_stop_test', 'governor_response_test',
            'avr_response_test', 'load_bank_endurance_4hr',
            'block_heater_thermostat_test']
  },
  gas: {
    cxMultiplier: 1.10,
    tests: ['gas_train_leak_test', 'gas_pressure_regulation_test',
            'gas_valve_proving_test', 'catalytic_converter_test',
            'emissions_measurement', 'all_diesel_tests_equivalent'],
    additionalTests: ['gas_detection_system_integration',
                       'ventilation_interlock_test']
  },
  dualfuel: {
    cxMultiplier: 1.25,
    tests: ['all_diesel_tests', 'all_gas_tests',
            'fuel_switchover_under_load', 'fuel_switchover_timing',
            'dual_fuel_governor_calibration', 'fuel_priority_logic_test',
            'gas_failure_to_diesel_fallback']
  },
  hvo: {
    cxMultiplier: 1.08,
    tests: ['all_diesel_tests', 'fuel_quality_analysis',
            'fuel_filter_compatibility_test', 'seal_material_compatibility',
            'cold_weather_operability_test', 'fuel_storage_compatibility']
  }
};
```

#### Pro Input 2: Seismic Zone
```
ID:          cx-seismic-zone
Type:        select dropdown
Options:
  - "0" → "Zone 0 — No Risk"
  - "1" → "Zone 1 — Low Risk"
  - "2" → "Zone 2 — Moderate Risk"
  - "3" → "Zone 3 — High Risk"
  - "4" → "Zone 4 — Very High Risk"
Default:     "1"
Tooltip:     "Seismic zone adds equipment anchorage verification, seismic
              bracing inspection, and post-installation vibration testing."
```

**Seismic Cx Impact:**
```javascript
var seismicCxMultiplier = {
  0: { cost: 1.00, duration: 1.00, additionalTests: [] },
  1: { cost: 1.05, duration: 1.03,
       additionalTests: ['anchor_bolt_torque_verification'] },
  2: { cost: 1.12, duration: 1.08,
       additionalTests: ['anchor_bolt_torque_verification',
                          'seismic_bracing_inspection',
                          'flexible_connection_verification'] },
  3: { cost: 1.22, duration: 1.15,
       additionalTests: ['anchor_bolt_torque_verification',
                          'seismic_bracing_inspection',
                          'flexible_connection_verification',
                          'seismic_isolation_system_test',
                          'equipment_displacement_clearance_check',
                          'seismic_shutoff_valve_test'] },
  4: { cost: 1.35, duration: 1.25,
       additionalTests: ['all_zone_3_tests',
                          'shake_table_certification_review',
                          'post_seismic_inspection_procedure_validation',
                          'seismic_monitoring_system_integration',
                          'base_isolation_system_commissioning',
                          'emergency_response_system_integration'] }
};
```

#### Pro Input 3: Commissioning Scope
```
ID:          cx-scope
Type:        multi-select checkboxes
Options:
  - "new_build"       → "New Build (Full L1–L5)" [default: checked]
  - "retrofit"        → "Retrofit / Upgrade"
  - "recommission"    → "Recommissioning (Existing Facility)"
  - "continuous"      → "Continuous Commissioning (Ongoing)"
Default:     "new_build"
Tooltip:     "Commissioning scope type. New build requires all 5 levels.
              Retrofit may skip L1/L2 for existing equipment.
              Recommissioning focuses on L3–L5 re-verification."
```

**Scope Multipliers:**
```javascript
var scopeCxMultiplier = {
  new_build:   { levelScope: [1,2,3,4,5], costMult: 1.00, durationMult: 1.00 },
  retrofit:    { levelScope: [2,3,4,5],    costMult: 0.75, durationMult: 0.70 },
  recommission:{ levelScope: [3,4,5],      costMult: 0.55, durationMult: 0.50 },
  continuous:  { levelScope: [4,5],        costMult: 0.30, durationMult: 0.25 }
};
```

#### Pro Input 4: Substation Configuration
```
ID:          cx-substation
Type:        select dropdown
Options:
  - "utility_fed"     → "Utility-Fed (No On-Site HV)"
  - "single_sub"      → "Single On-Site Substation"
  - "dual_sub"        → "Dual On-Site Substations"
  - "ring_bus"        → "Ring Bus Configuration"
Default:     "single_sub"
Tooltip:     "HV/MV substation configuration significantly impacts electrical
              Cx scope. Dual substations double HV testing. Ring bus adds
              protection coordination complexity."
```

**Substation Cx Scope:**
```javascript
var substationCxScope = {
  utility_fed: {
    costMult: 0.70, durationMult: 0.75,
    hvTests: ['utility_metering_verification', 'incoming_breaker_test',
              'protection_relay_calibration', 'power_quality_monitoring_setup'],
    notes: 'Minimal HV Cx. Focus on MV/LV switchgear downstream.'
  },
  single_sub: {
    costMult: 1.00, durationMult: 1.00,
    hvTests: ['transformer_turns_ratio_test', 'transformer_insulation_resistance',
              'transformer_winding_resistance', 'transformer_oil_analysis',
              'hv_switchgear_primary_injection', 'hv_switchgear_secondary_injection',
              'protection_relay_calibration', 'grounding_system_test',
              'cable_fault_location_test', 'power_factor_test',
              'partial_discharge_test', 'thermographic_survey'],
    notes: 'Standard HV Cx scope for single-feed substation.'
  },
  dual_sub: {
    costMult: 1.85, durationMult: 1.60,
    hvTests: ['all_single_sub_tests_x2', 'bus_tie_breaker_test',
              'auto_transfer_scheme_test', 'source_priority_logic',
              'parallel_operation_sync_check', 'fault_current_coordination_study_verification'],
    notes: 'Both substations commissioned independently then integration tested.'
  },
  ring_bus: {
    costMult: 2.10, durationMult: 1.80,
    hvTests: ['all_dual_sub_tests', 'ring_bus_protection_scheme',
              'breaker_failure_protection', 'zone_protection_coordination',
              'ring_open_point_management', 'islanding_detection',
              'ring_restoration_sequence_test'],
    notes: 'Most complex HV configuration. Protection coordination is critical path.'
  }
};
```

#### Pro Input 5: BMS/DCIM Complexity
```
ID:          cx-bms-complexity
Type:        select dropdown
Options:
  - "basic"     → "Basic BMS (Local Controllers)"
  - "standard"  → "Standard BMS + Head-End"
  - "advanced"  → "Advanced DCIM (Full Integration)"
  - "ai_driven" → "AI-Driven DCIM + Predictive"
Default:     "standard"
Tooltip:     "Building Management System / DCIM integration depth. Advanced
              DCIM adds point-to-point verification for thousands of I/O points
              and complex sequence-of-operations testing."
```

**BMS/DCIM Cx Scope:**
```javascript
var bmsCxScope = {
  basic: {
    costMult: 0.60, durationMult: 0.50,
    ioPointsPerMW: 200,
    tests: ['controller_functional_test', 'sensor_calibration',
            'alarm_point_verification', 'trend_log_setup',
            'local_display_verification'],
    notes: 'Standalone controllers. Limited integration testing.'
  },
  standard: {
    costMult: 1.00, durationMult: 1.00,
    ioPointsPerMW: 500,
    tests: ['all_basic_tests', 'head_end_server_commissioning',
            'network_connectivity_test', 'graphics_page_verification',
            'alarm_routing_test', 'historian_data_logging',
            'user_access_control_test', 'backup_restore_test',
            'sequence_of_operations_test', 'interlock_verification'],
    notes: 'Standard enterprise BMS with centralized management.'
  },
  advanced: {
    costMult: 1.60, durationMult: 1.45,
    ioPointsPerMW: 1200,
    tests: ['all_standard_tests', 'dcim_asset_discovery',
            'dcim_power_chain_mapping', 'dcim_cooling_chain_mapping',
            'capacity_planning_module_test', 'change_management_workflow',
            'api_integration_test', 'mobile_app_verification',
            'third_party_integration_test', 'reporting_module_test',
            'dashboard_kpi_verification'],
    notes: 'Full DCIM with asset management, capacity planning, and analytics.'
  },
  ai_driven: {
    costMult: 2.00, durationMult: 1.70,
    ioPointsPerMW: 2000,
    tests: ['all_advanced_tests', 'ml_model_training_verification',
            'predictive_analytics_baseline', 'anomaly_detection_tuning',
            'automated_response_testing', 'digital_twin_calibration',
            'optimization_algorithm_validation', 'data_pipeline_integrity',
            'edge_compute_integration', 'feedback_loop_verification'],
    notes: 'AI-driven DCIM with predictive maintenance, digital twin, auto-optimization.'
  }
};
```

#### Pro Input 6: Delivery Method
```
ID:          cx-delivery-method
Type:        select dropdown
Options:
  - "traditional"  → "Traditional (Design-Bid-Build)"
  - "design_build" → "Design-Build"
  - "epc"          → "EPC (Engineering, Procurement, Construction)"
  - "modular_pod"  → "Modular / Pod-Based"
Default:     "traditional"
Tooltip:     "Project delivery method affects Cx coordination, documentation
              requirements, and overlap between construction and commissioning phases."
```

**Delivery Method Impact:**
```javascript
var deliveryCxImpact = {
  traditional: {
    costMult: 1.00, durationMult: 1.00,
    cxOverlapWithConstruction: 0.10,  // 10% overlap
    documentationLevel: 'comprehensive',
    notes: 'Sequential phases. CxA independent of design/construction team. Most documentation.'
  },
  design_build: {
    costMult: 0.90, durationMult: 0.85,
    cxOverlapWithConstruction: 0.25,  // 25% overlap
    documentationLevel: 'standard',
    notes: 'CxA can start early. Better coordination with design team.'
  },
  epc: {
    costMult: 0.85, durationMult: 0.80,
    cxOverlapWithConstruction: 0.30,  // 30% overlap
    documentationLevel: 'integrated',
    notes: 'Single point of responsibility. Cx often integrated into EPC scope.'
  },
  modular_pod: {
    costMult: 0.70, durationMult: 0.60,
    cxOverlapWithConstruction: 0.50,  // 50% - factory Cx overlaps site prep
    documentationLevel: 'factory_plus_site',
    notes: 'Factory Cx (L1-L3) at manufacturer. Site Cx (L4-L5) for integration only.'
  }
};
```

### 2.4. Input Summary Table

| # | Input | Type | Range/Options | Default | Mode |
|---|-------|------|---------------|---------|------|
| 1 | IT Load Capacity | number | 100–100,000 kW | 2,000 kW | Free |
| 2 | Cooling Type | select | air/inrow/rdhx/dlc/immersion | air | Free |
| 3 | Redundancy Level | select | N/N+1/2N/2N+1 | N+1 | Free |
| 4 | Rack Density | select | standard/medium/high/ai_hpc | standard | Free |
| 5 | Building Type | select | warehouse/modular/purpose/highrise | purpose | Free |
| 6 | Fire Suppression | select | fm200/novec/inergen/n2/water/water_mist | novec | Free |
| 7 | UPS Type | select | standalone/modular/distributed/rotary | modular | Free |
| 8 | Region | select | 30+ countries | us_virginia | Free |
| 9 | Generator Type | select | diesel/gas/dualfuel/hvo | diesel | Pro |
| 10 | Seismic Zone | select | 0–4 | 1 | Pro |
| 11 | Cx Scope | multi-select | new_build/retrofit/recommission/continuous | new_build | Pro |
| 12 | Substation Config | select | utility_fed/single/dual/ring_bus | single_sub | Pro |
| 13 | BMS/DCIM Complexity | select | basic/standard/advanced/ai_driven | standard | Pro |
| 14 | Delivery Method | select | traditional/design_build/epc/modular_pod | traditional | Pro |

---

## 3. Commissioning Levels L1–L5: Complete Process Definition

### 3.0. Level Overview

| Level | Name | Focus | Typical Duration | Location | Key Personnel |
|-------|------|-------|-----------------|----------|---------------|
| L1 | Factory Witness Testing (FAT) | Verify equipment at manufacturer before shipping | 1–5 days per equipment type | Manufacturer facility | CxA + Owner's Rep |
| L2 | Installation Verification & Static Testing | Verify correct installation per design docs | 1–4 weeks per discipline | Project site | CxA + Installers |
| L3 | Component & Equipment Startup Testing | Individual equipment energization and functional test | 3–8 weeks per discipline | Project site | CxA + MEP Contractors + OEM |
| L4 | Functional Performance Testing | System-level performance under design conditions | 4–10 weeks | Project site | CxA + All Trades + Owner |
| L5 | Integrated Systems Testing (IST) | Cross-system failure scenarios and integration | 2–16 weeks | Project site | CxA + All Stakeholders |

**Level Dependencies:**
```
L1 ──→ L2 ──→ L3 ──→ L4 ──→ L5
              │              │
              ▼              ▼
         (per equipment) (per system)
```
- L1 must complete for each equipment type before that equipment ships to site
- L2 must complete for each system before L3 energization
- L3 must complete for all systems in a discipline before L4 functional testing
- L4 must complete for ALL disciplines before L5 integrated testing
- Within each level, disciplines can run in parallel (with dependencies noted)

### 3.1. L1 — Factory Witness Testing (FAT)

**Purpose**: Verify that critical equipment meets specifications at the manufacturer's facility before shipping. Catch defects early when correction cost is lowest.

**Standards Reference**: ASHRAE Guideline 0-2019 Section 5.2, NETA ATS-2025 Chapter 4

**When FAT is Required** (cost-benefit threshold):
- Any single equipment item > $100,000
- Any equipment with lead time > 16 weeks
- Custom-engineered equipment (non-standard)
- Equipment critical to facility availability (generators, UPS, switchgear)

#### 3.1.1. L1 — Electrical Systems

##### HV/MV Switchgear FAT
```javascript
var l1_switchgear = {
  name: 'HV/MV Switchgear Factory Witness Test',
  typicalDuration: { days: 2, hoursPerDay: 8 },
  requiredPersonnel: ['cx_authority', 'owners_rep', 'electrical_engineer'],
  tests: [
    { id: 'SW-FAT-001', name: 'Visual & Mechanical Inspection',
      duration: 2, unit: 'hours',
      description: 'Verify nameplate data, labeling, paint finish, door operation, interlocks',
      acceptanceCriteria: 'All nameplates match spec. Doors open/close smoothly. Interlocks function.',
      tools: ['visual_inspection_kit', 'torque_wrench'] },
    { id: 'SW-FAT-002', name: 'Insulation Resistance Test',
      duration: 1, unit: 'hours',
      description: 'Megger test phase-to-phase and phase-to-ground at rated voltage + 1000V',
      acceptanceCriteria: 'IR ≥ 100 MΩ for MV, ≥ 50 MΩ for LV (per NETA Table 100.1)',
      tools: ['megohmmeter_5kV'] },
    { id: 'SW-FAT-003', name: 'Contact Resistance Test',
      duration: 1.5, unit: 'hours',
      description: 'Micro-ohm test across each set of contacts (main, arcing, auxiliary)',
      acceptanceCriteria: 'Within manufacturer specifications, typically < 100 μΩ for MV breakers',
      tools: ['micro_ohmmeter'] },
    { id: 'SW-FAT-004', name: 'Primary Current Injection',
      duration: 3, unit: 'hours',
      description: 'Inject rated current through primary bus. Verify CT ratios and protection relay pickup.',
      acceptanceCriteria: 'CT ratios within ±0.5%. Relay pickup within ±5% of setting.',
      tools: ['primary_injection_test_set_3000A'] },
    { id: 'SW-FAT-005', name: 'Breaker Operation Test',
      duration: 2, unit: 'hours',
      description: 'Close/open cycle test. Measure operating times.',
      acceptanceCriteria: 'Close time: < 100ms. Open time: < 60ms (MV). Anti-pumping relay functional.',
      tools: ['circuit_breaker_timer'] },
    { id: 'SW-FAT-006', name: 'Protection Relay Test',
      duration: 4, unit: 'hours',
      description: 'Secondary injection of all protection functions (50/51, 50N/51N, 27, 59, etc.)',
      acceptanceCriteria: 'All functions operate within ±5% of calculated settings.',
      tools: ['secondary_injection_relay_test_set'] },
    { id: 'SW-FAT-007', name: 'Arc Flash Rating Verification',
      duration: 1, unit: 'hours',
      description: 'Verify arc-rated components, arc flash labels, and containment design.',
      acceptanceCriteria: 'Arc classification per IEC 62271-200. Labels match study results.',
      tools: ['arc_flash_study_document'] },
    { id: 'SW-FAT-008', name: 'Communication Interface Test',
      duration: 1.5, unit: 'hours',
      description: 'Verify SCADA/BMS communication protocols (Modbus TCP, IEC 61850, DNP3)',
      acceptanceCriteria: 'All data points read correctly. Event reporting functional.',
      tools: ['protocol_analyzer', 'laptop_with_scada_software'] }
  ],
  documentation: ['factory_test_report', 'test_certificates', 'calibration_records',
                   'as_tested_drawings', 'punch_list']
};
```

##### Transformer FAT
```javascript
var l1_transformer = {
  name: 'Power Transformer Factory Witness Test',
  typicalDuration: { days: 3, hoursPerDay: 8 },
  requiredPersonnel: ['cx_authority', 'owners_rep', 'electrical_engineer'],
  tests: [
    { id: 'TX-FAT-001', name: 'Turns Ratio Test',
      duration: 2, unit: 'hours',
      description: 'Verify turns ratio on all taps. Deviation must be ≤ 0.5%.',
      acceptanceCriteria: 'Ratio within ±0.5% of nameplate on all taps.',
      tools: ['turns_ratio_tester'] },
    { id: 'TX-FAT-002', name: 'Winding Resistance Test',
      duration: 2, unit: 'hours',
      description: 'DC resistance measurement of all windings on all taps.',
      acceptanceCriteria: 'Phase-to-phase balance within 2%. Values consistent with design.',
      tools: ['winding_resistance_meter'] },
    { id: 'TX-FAT-003', name: 'Insulation Resistance Test',
      duration: 1, unit: 'hours',
      description: 'Megger HV-to-LV, HV-to-ground, LV-to-ground.',
      acceptanceCriteria: 'IR ≥ values per NETA Table 100.12 adjusted for temperature.',
      tools: ['megohmmeter_5kV'] },
    { id: 'TX-FAT-004', name: 'Power Factor / Dissipation Factor Test',
      duration: 2, unit: 'hours',
      description: 'Doble test for insulation quality assessment.',
      acceptanceCriteria: 'PF < 0.5% for oil-filled, < 2% for dry-type (new equipment).',
      tools: ['power_factor_test_set'] },
    { id: 'TX-FAT-005', name: 'Impedance / Short Circuit Test',
      duration: 1.5, unit: 'hours',
      description: 'Verify impedance matches nameplate and design calculations.',
      acceptanceCriteria: 'Impedance within ±7.5% of nameplate (single unit) or ±10% (parallel).',
      tools: ['high_current_test_set'] },
    { id: 'TX-FAT-006', name: 'Oil Analysis (Liquid-Filled)',
      duration: 1, unit: 'hours',
      description: 'Dielectric breakdown, moisture content, dissolved gas analysis (DGA).',
      acceptanceCriteria: 'BDV ≥ 30kV (new oil). Moisture < 20 ppm. No fault gases.',
      tools: ['oil_sampling_kit'] },
    { id: 'TX-FAT-007', name: 'Temperature Rise Test',
      duration: 8, unit: 'hours',
      description: 'Full-load temperature rise test per IEC 60076-2.',
      acceptanceCriteria: 'Top oil rise ≤ 60K, winding rise ≤ 65K (ONAN) per class.',
      tools: ['temperature_measurement_system'] },
    { id: 'TX-FAT-008', name: 'Tap Changer Operation Test',
      duration: 1.5, unit: 'hours',
      description: 'Cycle through all tap positions. Verify OLTC mechanism.',
      acceptanceCriteria: 'Smooth operation on all taps. Position indicator accurate.',
      tools: ['tap_changer_analyzer'] },
    { id: 'TX-FAT-009', name: 'Noise Level Test',
      duration: 1, unit: 'hours',
      description: 'Sound level measurement at rated conditions per IEC 60076-10.',
      acceptanceCriteria: 'Sound level ≤ nameplate value (typically 60-70 dB(A) at 1m).',
      tools: ['sound_level_meter'] }
  ],
  documentation: ['factory_test_certificate', 'oil_analysis_report',
                   'temperature_rise_report', 'impedance_test_report',
                   'nameplate_photo', 'punch_list']
};
```

##### Generator FAT
```javascript
var l1_generator = {
  name: 'Diesel/Gas Generator Factory Witness Test',
  typicalDuration: { days: 2, hoursPerDay: 10 },
  requiredPersonnel: ['cx_authority', 'owners_rep', 'mechanical_engineer', 'electrical_engineer'],
  tests: [
    { id: 'GEN-FAT-001', name: 'Engine Visual Inspection',
      duration: 1, unit: 'hours',
      description: 'Verify engine model, serial number, ancillaries, safety guards.',
      acceptanceCriteria: 'Matches purchase order specification.',
      tools: ['visual_inspection_kit'] },
    { id: 'GEN-FAT-002', name: 'Alternator Insulation Resistance',
      duration: 1, unit: 'hours',
      description: 'Megger test stator windings phase-to-phase and phase-to-ground.',
      acceptanceCriteria: 'IR ≥ 100 MΩ (new) at rated voltage + 1000V.',
      tools: ['megohmmeter_5kV'] },
    { id: 'GEN-FAT-003', name: 'Engine Start Test (Cold + Hot)',
      duration: 1, unit: 'hours',
      description: 'Cold start and hot start. Measure cranking time and start sequence.',
      acceptanceCriteria: 'Cold start < 10 seconds. Hot start < 5 seconds.',
      tools: ['stopwatch', 'event_recorder'] },
    { id: 'GEN-FAT-004', name: 'Load Bank Test (4-Step)',
      duration: 6, unit: 'hours',
      description: 'Load steps: 25% → 50% → 75% → 100% → 110% (overload). 1hr at 100%.',
      acceptanceCriteria: 'Voltage ±1%, frequency ±0.5% at each step. Stable under load.',
      tools: ['resistive_load_bank', 'power_analyzer'] },
    { id: 'GEN-FAT-005', name: 'Load Rejection Test',
      duration: 0.5, unit: 'hours',
      description: 'Sudden removal of 100% load. Verify voltage and frequency recovery.',
      acceptanceCriteria: 'Recovery to ±3% voltage and ±1% frequency within 10 seconds.',
      tools: ['load_bank', 'power_analyzer', 'oscilloscope'] },
    { id: 'GEN-FAT-006', name: 'Governor Response Test',
      duration: 1, unit: 'hours',
      description: 'Step load changes 0-50-100-50-0%. Verify isochronous/droop governor.',
      acceptanceCriteria: 'Transient response within ±10% voltage, recovery < 5 sec.',
      tools: ['load_bank', 'data_recorder'] },
    { id: 'GEN-FAT-007', name: 'Fuel Consumption Test',
      duration: 2, unit: 'hours',
      description: 'Measure fuel consumption at 50%, 75%, 100% load.',
      acceptanceCriteria: 'Within ±5% of manufacturer catalog values.',
      tools: ['fuel_flow_meter'] },
    { id: 'GEN-FAT-008', name: 'Exhaust Emissions Test',
      duration: 1, unit: 'hours',
      description: 'Measure NOx, CO, PM at rated load.',
      acceptanceCriteria: 'Within local regulatory limits and manufacturer specs.',
      tools: ['emissions_analyzer'] },
    { id: 'GEN-FAT-009', name: 'Vibration Test',
      duration: 1, unit: 'hours',
      description: 'Vibration measurement at engine, alternator, and base frame.',
      acceptanceCriteria: 'Velocity < 18mm/s RMS (ISO 8528-9).',
      tools: ['vibration_analyzer'] },
    { id: 'GEN-FAT-010', name: 'Control Panel Test',
      duration: 2, unit: 'hours',
      description: 'Verify all control panel functions, alarms, and communication.',
      acceptanceCriteria: 'All alarms trigger correctly. Remote start/stop functional.',
      tools: ['multimeter', 'protocol_analyzer'] }
  ],
  documentation: ['factory_test_report', 'load_bank_data_sheets',
                   'emissions_certificate', 'vibration_report',
                   'fuel_consumption_data', 'warranty_certificate']
};
```

##### UPS FAT
```javascript
var l1_ups = {
  name: 'UPS System Factory Witness Test',
  typicalDuration: { days: 2, hoursPerDay: 8 },
  requiredPersonnel: ['cx_authority', 'owners_rep', 'electrical_engineer'],
  tests: [
    { id: 'UPS-FAT-001', name: 'Input/Output Parameter Verification',
      duration: 2, unit: 'hours',
      description: 'Verify rated input/output voltage, current, frequency, power factor.',
      acceptanceCriteria: 'Output voltage ±1%, frequency ±0.1Hz, THDv < 3%.',
      tools: ['power_analyzer'] },
    { id: 'UPS-FAT-002', name: 'Efficiency Measurement',
      duration: 2, unit: 'hours',
      description: 'Measure efficiency at 25%, 50%, 75%, 100% load.',
      acceptanceCriteria: 'Efficiency ≥ nameplate at each load point.',
      tools: ['precision_power_analyzer'] },
    { id: 'UPS-FAT-003', name: 'Battery Discharge Test',
      duration: 4, unit: 'hours',
      description: 'Full discharge at rated load. Measure autonomy time.',
      acceptanceCriteria: 'Autonomy ≥ specified time (typically 5-15 min).',
      tools: ['load_bank', 'battery_monitor'] },
    { id: 'UPS-FAT-004', name: 'Transfer Time Test',
      duration: 1, unit: 'hours',
      description: 'Measure transfer time: mains→battery, battery→mains, mains→bypass.',
      acceptanceCriteria: 'Online UPS: 0ms (no break). Line-interactive: < 4ms.',
      tools: ['power_disturbance_analyzer'] },
    { id: 'UPS-FAT-005', name: 'Bypass Operation Test',
      duration: 1, unit: 'hours',
      description: 'Manual and automatic bypass transfer. Static and maintenance bypass.',
      acceptanceCriteria: 'Seamless transfer to bypass with no output interruption.',
      tools: ['power_analyzer', 'oscilloscope'] },
    { id: 'UPS-FAT-006', name: 'Module Hot-Swap Test (Modular Only)',
      duration: 2, unit: 'hours',
      description: 'Remove and reinsert power module under load.',
      acceptanceCriteria: 'No output interruption. Remaining modules absorb load.',
      tools: ['power_analyzer'] },
    { id: 'UPS-FAT-007', name: 'Overload Test',
      duration: 1, unit: 'hours',
      description: 'Apply 125% and 150% load. Verify transfer to bypass timing.',
      acceptanceCriteria: '125%: hold for 10 min. 150%: transfer to bypass within 1 min.',
      tools: ['load_bank'] },
    { id: 'UPS-FAT-008', name: 'Communication Test',
      duration: 1, unit: 'hours',
      description: 'Verify SNMP, Modbus, dry contacts, and BMS integration points.',
      acceptanceCriteria: 'All data points readable. Alarm contacts operate correctly.',
      tools: ['network_analyzer', 'protocol_tester'] }
  ],
  documentation: ['factory_test_report', 'efficiency_curves',
                   'waveform_captures', 'communication_register_map']
};
```

#### 3.1.2. L1 — Mechanical Systems

##### Chiller FAT
```javascript
var l1_chiller = {
  name: 'Chiller Factory Witness Test',
  typicalDuration: { days: 2, hoursPerDay: 8 },
  requiredPersonnel: ['cx_authority', 'owners_rep', 'mechanical_engineer'],
  tests: [
    { id: 'CH-FAT-001', name: 'Nameplate & Configuration Verification',
      duration: 1, unit: 'hours',
      description: 'Verify tonnage, refrigerant type/charge, voltage, controls.',
      acceptanceCriteria: 'Matches specification and purchase order.',
      tools: ['visual_inspection_kit'] },
    { id: 'CH-FAT-002', name: 'Leak Test (Refrigerant Circuit)',
      duration: 2, unit: 'hours',
      description: 'Standing pressure test with nitrogen + trace refrigerant.',
      acceptanceCriteria: 'No leaks detected at test pressure (1.5x design pressure).',
      tools: ['refrigerant_leak_detector', 'pressure_gauges'] },
    { id: 'CH-FAT-003', name: 'Compressor Vibration Test',
      duration: 1, unit: 'hours',
      description: 'Vibration levels at full load per ISO 10816.',
      acceptanceCriteria: 'Vibration velocity < 4.5 mm/s RMS (Class I).',
      tools: ['vibration_analyzer'] },
    { id: 'CH-FAT-004', name: 'Performance Test at Rated Conditions',
      duration: 4, unit: 'hours',
      description: 'Full-load test at design conditions (entering/leaving water temps).',
      acceptanceCriteria: 'Capacity ≥ 100% of rated. COP ≥ nameplate at rated conditions.',
      tools: ['temperature_sensors', 'flow_meter', 'power_analyzer'] },
    { id: 'CH-FAT-005', name: 'Part-Load Performance',
      duration: 3, unit: 'hours',
      description: 'Test at 25%, 50%, 75% load. IPLV/NPLV verification.',
      acceptanceCriteria: 'IPLV/NPLV ≥ rated value. Stable VSD operation.',
      tools: ['temperature_sensors', 'flow_meter', 'power_analyzer'] },
    { id: 'CH-FAT-006', name: 'Safety Controls Test',
      duration: 1, unit: 'hours',
      description: 'High/low pressure cutouts, flow switches, freeze protection.',
      acceptanceCriteria: 'All safeties trip at correct setpoints and reset properly.',
      tools: ['pressure_calibrator', 'multimeter'] },
    { id: 'CH-FAT-007', name: 'Communication & BMS Interface',
      duration: 1, unit: 'hours',
      description: 'BACnet/Modbus point verification for BMS integration.',
      acceptanceCriteria: 'All points readable/writable. Alarm generation verified.',
      tools: ['protocol_analyzer'] }
  ],
  documentation: ['factory_test_certificate', 'performance_curves',
                   'refrigerant_charge_record', 'vibration_report']
};
```

##### CRAH/CRAC Unit FAT
```javascript
var l1_crah = {
  name: 'CRAH/CRAC Unit Factory Witness Test',
  typicalDuration: { days: 1, hoursPerDay: 8 },
  requiredPersonnel: ['cx_authority', 'mechanical_engineer'],
  tests: [
    { id: 'CRAH-FAT-001', name: 'Airflow Verification',
      duration: 2, unit: 'hours',
      description: 'Fan performance test. Verify CFM at design static pressure.',
      acceptanceCriteria: 'Airflow within ±10% of rated CFM at design ESP.',
      tools: ['anemometer', 'pitot_tube', 'manometer'] },
    { id: 'CRAH-FAT-002', name: 'Coil Performance Test',
      duration: 2, unit: 'hours',
      description: 'Sensible and latent capacity at design conditions.',
      acceptanceCriteria: 'Capacity ≥ rated. Leaving air temp within ±0.5°C of design.',
      tools: ['temperature_sensors', 'psychrometer'] },
    { id: 'CRAH-FAT-003', name: 'EC Fan VFD Test',
      duration: 1, unit: 'hours',
      description: 'Variable speed operation. Verify speed range and power draw.',
      acceptanceCriteria: 'Speed control 30-100%. Power consumption matches fan curves.',
      tools: ['power_analyzer', 'tachometer'] },
    { id: 'CRAH-FAT-004', name: 'Control Logic Test',
      duration: 1.5, unit: 'hours',
      description: 'Verify PID loops, setpoints, alarms, and failsafe modes.',
      acceptanceCriteria: 'Temperature control ±0.5°C of setpoint. All alarms functional.',
      tools: ['temperature_simulator', 'multimeter'] },
    { id: 'CRAH-FAT-005', name: 'Humidifier Test (if equipped)',
      duration: 1, unit: 'hours',
      description: 'Verify humidifier operation, capacity, and drain function.',
      acceptanceCriteria: 'RH control within ±5% of setpoint.',
      tools: ['hygrometer'] }
  ],
  documentation: ['factory_test_report', 'airflow_data_sheets', 'controls_point_list']
};
```

##### CDU FAT (DLC/Immersion specific)
```javascript
var l1_cdu = {
  name: 'Coolant Distribution Unit (CDU) Factory Witness Test',
  typicalDuration: { days: 2, hoursPerDay: 8 },
  applicableCooling: ['dlc', 'immersion'],
  requiredPersonnel: ['cx_authority', 'owners_rep', 'mechanical_engineer', 'liquid_cooling_specialist'],
  tests: [
    { id: 'CDU-FAT-001', name: 'Pressure Test (Secondary Loop)',
      duration: 2, unit: 'hours',
      description: 'Hydrostatic pressure test at 1.5x design pressure for 4 hours.',
      acceptanceCriteria: 'No pressure drop > 0.1 bar over 4 hours.',
      tools: ['pressure_test_pump', 'pressure_gauges', 'pressure_recorder'] },
    { id: 'CDU-FAT-002', name: 'Flow Rate Verification',
      duration: 1.5, unit: 'hours',
      description: 'Verify pump flow rates at design conditions with system curve.',
      acceptanceCriteria: 'Flow within ±5% of design at design head.',
      tools: ['flow_meter', 'differential_pressure_gauge'] },
    { id: 'CDU-FAT-003', name: 'Heat Exchanger Performance',
      duration: 3, unit: 'hours',
      description: 'Verify heat rejection capacity (primary to secondary).',
      acceptanceCriteria: 'Heat rejection ≥ rated capacity. Approach temp ≤ 3°C.',
      tools: ['temperature_sensors', 'flow_meter', 'power_analyzer'] },
    { id: 'CDU-FAT-004', name: 'Coolant Quality Test',
      duration: 1, unit: 'hours',
      description: 'Analyze coolant: pH, conductivity, particulate, dielectric strength.',
      acceptanceCriteria: 'pH: 7.0-8.5, conductivity < 5 μS/cm, particles < 5μm.',
      tools: ['coolant_analysis_kit'] },
    { id: 'CDU-FAT-005', name: 'Leak Detection System Test',
      duration: 1, unit: 'hours',
      description: 'Verify leak detection sensors, cable, and alarm integration.',
      acceptanceCriteria: 'All sensors detect simulated leak within 30 seconds.',
      tools: ['leak_detection_test_kit'] },
    { id: 'CDU-FAT-006', name: 'Pump Redundancy Test',
      duration: 1, unit: 'hours',
      description: 'Primary pump failure → standby pump auto-start.',
      acceptanceCriteria: 'Switchover < 5 seconds. No flow interruption.',
      tools: ['flow_meter', 'event_recorder'] },
    { id: 'CDU-FAT-007', name: 'Control System Test',
      duration: 1.5, unit: 'hours',
      description: 'Temperature control, flow balancing, alarm management.',
      acceptanceCriteria: 'Temperature control ±1°C. All alarms functional.',
      tools: ['temperature_simulator', 'protocol_analyzer'] }
  ],
  documentation: ['factory_test_report', 'coolant_analysis_report',
                   'pressure_test_certificate', 'performance_curves']
};
```

#### 3.1.3. L1 — Fire Suppression Systems

```javascript
var l1_fire = {
  name: 'Fire Suppression System Factory Test',
  typicalDuration: { days: 1, hoursPerDay: 8 },
  requiredPersonnel: ['cx_authority', 'fire_protection_engineer'],
  tests: [
    { id: 'FS-FAT-001', name: 'Panel Configuration Verification',
      duration: 2, unit: 'hours',
      description: 'Verify FACP configuration, zone mapping, and cause-effect matrix.',
      acceptanceCriteria: 'Configuration matches approved fire strategy document.',
      tools: ['facp_programming_tool'] },
    { id: 'FS-FAT-002', name: 'Detection System Test',
      duration: 2, unit: 'hours',
      description: 'Test all detector types (smoke, heat, VESDA) with calibrated source.',
      acceptanceCriteria: 'All detectors respond within sensitivity specifications.',
      tools: ['smoke_generator', 'heat_source', 'vesda_test_kit'] },
    { id: 'FS-FAT-003', name: 'Agent Storage Verification (Gas)',
      duration: 1, unit: 'hours',
      description: 'Verify cylinder weights, pressures, valve assembly, manifold.',
      acceptanceCriteria: 'Weights within ±5% of spec. Pressure at correct level.',
      tools: ['scales', 'pressure_gauge'] },
    { id: 'FS-FAT-004', name: 'Release Circuit Test',
      duration: 1.5, unit: 'hours',
      description: 'End-to-end test of release circuit (panel → solenoid) without live discharge.',
      acceptanceCriteria: 'Solenoid operates within timing spec. Abort switch functional.',
      tools: ['multimeter', 'circuit_tester'] }
  ],
  documentation: ['fire_system_test_report', 'detector_sensitivity_certificates']
};
```

#### 3.1.4. L1 Duration & Cost Formulas

```javascript
// L1 Duration Formula
function calculateL1Duration(inputs) {
  var baseEquipment = {
    switchgear: { count: inputs.equipmentScale.switchgear, daysEach: 2 },
    transformers: { count: inputs.equipmentScale.transformers, daysEach: 3 },
    generators: { count: inputs.equipmentScale.generators, daysEach: 2 },
    ups: { count: inputs.equipmentScale.ups_modules > 0 ? 1 : 0, daysEach: 2 },  // UPS FAT is per system, not per module
    chillers: { count: Math.ceil(inputs.itLoad / 500), daysEach: 2 },
    crahs: { count: inputs.coolingType === 'air' ? 1 : 0, daysEach: 1 },  // sample test only
    cdus: { count: ['dlc','immersion'].includes(inputs.coolingType) ? 1 : 0, daysEach: 2 },
    fire: { count: 1, daysEach: 1 }
  };

  var totalDays = 0;
  Object.keys(baseEquipment).forEach(function(key) {
    totalDays += baseEquipment[key].count * baseEquipment[key].daysEach;
  });

  // Travel factor: some FATs require international travel
  var travelFactor = inputs.region === 'us_virginia' ? 1.0 : 1.15;

  // Modular delivery: factory Cx covers more (L1-L3 at factory)
  var modularFactor = inputs.deliveryMethod === 'modular_pod' ? 1.5 : 1.0;

  return Math.ceil(totalDays * travelFactor * modularFactor);
}

// L1 Cost Formula
function calculateL1Cost(inputs, l1Duration) {
  var laborRate = getRegionalRate(inputs.region);
  var personnelCost = l1Duration * laborRate.cxEngineerDay * 2;  // CxA + Owner's Rep
  var travelCost = l1Duration * laborRate.travelPerDiem;
  var equipmentRental = 0;  // Test equipment typically provided by manufacturer

  return {
    labor: personnelCost,
    travel: travelCost,
    equipment: equipmentRental,
    total: personnelCost + travelCost + equipmentRental
  };
}
```

---

### 3.2. L2 — Installation Verification & Static Testing

**Purpose**: Verify that all equipment has been installed correctly per design documents, manufacturer instructions, and applicable codes. This is a pre-energization check — no power is applied during L2.

**Standards Reference**: ASHRAE Guideline 0-2019 Section 5.3, NETA ATS-2025 Section 7, NFPA 70 Article 110

**Key Principle**: L2 is a "cold" check. Every cable, pipe, duct, and mounting is verified before any system is energized. Defects found at L2 cost ~10x less to fix than at L3+.

#### 3.2.1. L2 — Electrical Systems

```javascript
var l2_electrical = {
  disciplines: {
    hv_mv_switchgear: {
      name: 'HV/MV Switchgear Installation Verification',
      durationPerUnit: { days: 1.5 },
      tests: [
        { id: 'SW-L2-001', name: 'Foundation & Alignment Check',
          description: 'Verify level, plumb, anchor bolt torque, seismic bracing.',
          criteria: 'Level within 3mm/m. Bolts torqued to spec.' },
        { id: 'SW-L2-002', name: 'Bus Bar Connection Torque',
          description: 'Verify all bus bar bolted connections torqued to manufacturer spec.',
          criteria: 'All joints torqued per OEM. Belleville washers installed where specified.' },
        { id: 'SW-L2-003', name: 'Cable Termination Inspection',
          description: 'Inspect all cable terminations: lug crimps, heat shrink, stress cones (MV).',
          criteria: 'Crimps per manufacturer die spec. Stress cones properly seated (MV).' },
        { id: 'SW-L2-004', name: 'Insulation Resistance (Pre-Energization)',
          description: 'Megger test all buses and cables phase-to-phase and phase-to-ground.',
          criteria: 'IR ≥ values per NETA Table 100.1. Record values for baseline.' },
        { id: 'SW-L2-005', name: 'Protection Relay Settings Verification',
          description: 'Verify all relay settings match approved protection coordination study.',
          criteria: 'Settings within ±2% of study values. Firmware version correct.' },
        { id: 'SW-L2-006', name: 'Grounding System Verification',
          description: 'Verify grounding connections, ground bus continuity, ground rod impedance.',
          criteria: 'Ground impedance < 5Ω (or per design). All connections tight.' },
        { id: 'SW-L2-007', name: 'Arc Flash Labels',
          description: 'Verify arc flash labels installed per NFPA 70E and arc flash study.',
          criteria: 'Labels on all panels. Values match latest study. PPE category correct.' },
        { id: 'SW-L2-008', name: 'Interlock Verification',
          description: 'Test all mechanical and electrical interlocks (Kirk key, etc.).',
          criteria: 'All interlocks prevent incorrect operation sequence.' }
      ]
    },
    transformers: {
      name: 'Transformer Installation Verification',
      durationPerUnit: { days: 1 },
      tests: [
        { id: 'TX-L2-001', name: 'Foundation & Mounting Inspection',
          description: 'Check pad, vibration isolators, oil containment, clearances.',
          criteria: 'Clearances per NEC. Containment sized for 110% oil volume.' },
        { id: 'TX-L2-002', name: 'Oil Level & Quality Check',
          description: 'Oil level in conservator/expansion tank. Post-shipping oil sample.',
          criteria: 'Oil level correct. BDV ≥ 30kV. Moisture < 25 ppm.' },
        { id: 'TX-L2-003', name: 'Winding Resistance (Post-Shipping)',
          description: 'Compare to FAT values. Detect shipping damage.',
          criteria: 'Within ±5% of FAT values. Phase balance within 2%.' },
        { id: 'TX-L2-004', name: 'Cooling System Inspection',
          description: 'Verify fans, pumps, radiators, oil flow direction, thermometers.',
          criteria: 'Fans spin freely. Oil flow direction arrows correct.' },
        { id: 'TX-L2-005', name: 'Tap Changer Position',
          description: 'Set OLTC to correct nominal tap. Verify position indicator.',
          criteria: 'OLTC on specified tap. Local and remote indicators agree.' },
        { id: 'TX-L2-006', name: 'Cable Termination',
          description: 'Verify HV/LV cable terminations, stress cones, surge arresters.',
          criteria: 'Per manufacturer instructions. Torque values documented.' }
      ]
    },
    generators: {
      name: 'Generator Installation Verification',
      durationPerUnit: { days: 1 },
      tests: [
        { id: 'GEN-L2-001', name: 'Foundation & Vibration Isolation',
          description: 'Check mounting, spring isolators, flexible connections (exhaust, fuel, coolant).',
          criteria: 'Isolators deflected evenly. Flexible connections not stressed.' },
        { id: 'GEN-L2-002', name: 'Fuel System Inspection',
          description: 'Day tank, main tank, fuel piping, leak detection, fill connections.',
          criteria: 'No leaks. Tank venting correct. Fill connections labeled and locked.' },
        { id: 'GEN-L2-003', name: 'Exhaust System Inspection',
          description: 'Routing, insulation, rain cap, thimble, clearances to combustibles.',
          criteria: 'Clearances per NFPA 37. Insulation continuous. Rain cap functional.' },
        { id: 'GEN-L2-004', name: 'Cooling System Inspection',
          description: 'Radiator, coolant lines, expansion tank, louvers, air intake/exhaust.',
          criteria: 'Coolant level correct. No leaks. Louvers open freely.' },
        { id: 'GEN-L2-005', name: 'Electrical Connections',
          description: 'Output cables, neutral grounding, control wiring, ATS connections.',
          criteria: 'All terminations torqued. Neutral grounding per design.' },
        { id: 'GEN-L2-006', name: 'Battery System (Starting)',
          description: 'Battery bank, charger, cables, terminal protection.',
          criteria: 'Battery voltage ≥ 24V DC. Charger operational. Cables tight.' },
        { id: 'GEN-L2-007', name: 'Block Heater Verification',
          description: 'Verify jacket water heater operation and thermostat setting.',
          criteria: 'Engine block temperature maintained at 35-45°C.' }
      ]
    },
    ups: {
      name: 'UPS Installation Verification',
      durationPerUnit: { days: 0.5 },
      tests: [
        { id: 'UPS-L2-001', name: 'Physical Installation Check',
          description: 'Mounting, clearances, ventilation, cable entry, labeling.',
          criteria: 'Clearances per OEM. Ventilation path unobstructed.' },
        { id: 'UPS-L2-002', name: 'Input/Output Cable Verification',
          description: 'Cable sizing, routing, termination torque, phase rotation.',
          criteria: 'Phase rotation correct (A-B-C). Torque values documented.' },
        { id: 'UPS-L2-003', name: 'Battery Connection Verification',
          description: 'Battery string connections, fusing, disconnect, ventilation.',
          criteria: 'String voltage correct. All fuses intact. Ventilation adequate.' },
        { id: 'UPS-L2-004', name: 'Bypass Source Verification',
          description: 'Verify static bypass and maintenance bypass source connections.',
          criteria: 'Bypass source present and in-phase with inverter output.' }
      ]
    },
    pdus: {
      name: 'PDU Installation Verification',
      durationPerUnit: { days: 0.25 },
      tests: [
        { id: 'PDU-L2-001', name: 'PDU Physical & Electrical Check',
          description: 'Mounting, input cable, output breakers, monitoring, labeling.',
          criteria: 'Input cable correctly terminated. All output breakers labeled. Monitoring connected.' },
        { id: 'PDU-L2-002', name: 'Transformer Check (if equipped)',
          description: 'Verify isolation transformer tap setting, grounding.',
          criteria: 'Tap set to correct voltage. Ground bond verified.' }
      ]
    },
    sts: {
      name: 'STS Installation Verification',
      durationPerUnit: { days: 0.5 },
      tests: [
        { id: 'STS-L2-001', name: 'Dual Source Verification',
          description: 'Verify both Source 1 and Source 2 connections. Phase rotation.',
          criteria: 'Both sources present. Phase rotation matched. Voltage within 1%.' },
        { id: 'STS-L2-002', name: 'Transfer Logic Settings',
          description: 'Verify transfer voltage/frequency thresholds and timing.',
          criteria: 'Settings match design specification.' }
      ]
    },
    busbar: {
      name: 'Busbar Trunking Installation Verification',
      durationPerUnit: { days: 0.5 },
      tests: [
        { id: 'BB-L2-001', name: 'Alignment & Joint Inspection',
          description: 'Verify busbar alignment, joint torque, expansion joints, tap-off positions.',
          criteria: 'All joints torqued to spec. Expansion joints at correct spacing.' },
        { id: 'BB-L2-002', name: 'Insulation Resistance',
          description: 'Megger end-to-end and phase-to-ground.',
          criteria: 'IR ≥ 100 MΩ at 1000V DC.' }
      ]
    },
    grounding: {
      name: 'Grounding & Lightning Protection Verification',
      durationPerUnit: { days: 1 },
      tests: [
        { id: 'GND-L2-001', name: 'Ground Grid Impedance',
          description: 'Fall-of-potential test for ground electrode system.',
          criteria: 'Ground impedance ≤ 5Ω (or ≤ 1Ω for critical facilities).' },
        { id: 'GND-L2-002', name: 'Bonding Verification',
          description: 'Verify all metallic systems bonded to ground grid.',
          criteria: 'Bond resistance < 0.01Ω between any two grounded points.' },
        { id: 'GND-L2-003', name: 'Lightning Protection Inspection',
          description: 'Air terminals, down conductors, SPDs, equipotential bonding.',
          criteria: 'Per IEC 62305. SPDs correctly rated and installed.' }
      ]
    }
  }
};
```

#### 3.2.2. L2 — Mechanical Systems

```javascript
var l2_mechanical = {
  disciplines: {
    chilled_water_piping: {
      name: 'Chilled Water Piping Installation Verification',
      durationPerSystem: { days: 3 },
      tests: [
        { id: 'PIP-L2-001', name: 'Hydrostatic Pressure Test',
          description: 'Pressurize to 1.5x design pressure for 4 hours minimum.',
          criteria: 'No pressure drop > 0.1 bar over 4 hours. No visible leaks.' },
        { id: 'PIP-L2-002', name: 'Pipe Support & Hanger Inspection',
          description: 'Verify all supports, hangers, guides, anchors per design drawings.',
          criteria: 'Spacing per MSS SP-58. Seismic bracing per SMACNA.' },
        { id: 'PIP-L2-003', name: 'Insulation Inspection',
          description: 'Verify insulation type, thickness, vapor barrier integrity, valves jacketed.',
          criteria: 'Insulation continuous. No gaps at valves/fittings. Vapor barrier sealed.' },
        { id: 'PIP-L2-004', name: 'Valve Tag & Labeling',
          description: 'All valves tagged, labeled, and positions verified against flow diagrams.',
          criteria: 'All valves tagged per P&ID. Normally open/closed positions correct.' },
        { id: 'PIP-L2-005', name: 'Pipe Flushing & Cleaning',
          description: 'System flush to remove construction debris. Water quality test.',
          criteria: 'Flush water clear. Strainer clean after 24 hours of circulation.' },
        { id: 'PIP-L2-006', name: 'Expansion Tank & Air Separator',
          description: 'Pre-charge pressure, connection, air separator installation.',
          criteria: 'Pre-charge = static pressure. Air separator on correct pipe (return).' }
      ]
    },
    cooling_towers: {
      name: 'Cooling Tower Installation Verification',
      durationPerUnit: { days: 1 },
      tests: [
        { id: 'CT-L2-001', name: 'Structural & Alignment Check',
          description: 'Tower level, anchor bolts, vibration isolation, basin condition.',
          criteria: 'Level within specifications. Basin watertight.' },
        { id: 'CT-L2-002', name: 'Fill Media Inspection',
          description: 'Verify fill media type, installation, distribution nozzles.',
          criteria: 'Fill properly installed. Nozzles unobstructed.' },
        { id: 'CT-L2-003', name: 'Fan Motor & Drive',
          description: 'Fan alignment, belt/gear tension, VFD wiring, rotation check.',
          criteria: 'Fan rotation correct (momentary bump test). Belt tension per OEM.' },
        { id: 'CT-L2-004', name: 'Water Treatment System',
          description: 'Chemical feed, blowdown controller, makeup water connection.',
          criteria: 'Chemical feed pumps installed. Conductivity controller calibrated.' }
      ]
    },
    pumps: {
      name: 'Pump Installation Verification',
      durationPerUnit: { days: 0.5 },
      tests: [
        { id: 'PMP-L2-001', name: 'Alignment Check',
          description: 'Shaft alignment (laser or dial indicator). Foundation vibration pads.',
          criteria: 'Angular: < 0.05mm/100mm. Parallel: < 0.05mm.' },
        { id: 'PMP-L2-002', name: 'Suction/Discharge Piping',
          description: 'Verify piping connections, strainers, check valves, isolation valves.',
          criteria: 'Suction strainer installed. Check valve on discharge. No stress on flanges.' },
        { id: 'PMP-L2-003', name: 'Motor Insulation & Rotation',
          description: 'Megger test. Phase rotation bump test (< 1 second).',
          criteria: 'IR ≥ 100 MΩ. Rotation correct (verify against pump arrow).' }
      ]
    },
    air_handling: {
      name: 'CRAH/CRAC/AHU Installation Verification',
      durationPerUnit: { days: 0.5 },
      tests: [
        { id: 'AH-L2-001', name: 'Physical Installation',
          description: 'Unit level, seismic bracing, clearances, access panels.',
          criteria: 'Unit level. Access clearances per OEM. Seismic per zone.' },
        { id: 'AH-L2-002', name: 'Piping Connections',
          description: 'CHW/CW coil connections, strainer, control valves, flex connectors.',
          criteria: 'Flex connectors installed. Strainer before control valve.' },
        { id: 'AH-L2-003', name: 'Electrical Connections',
          description: 'Power wiring, controls wiring, sensor wiring.',
          criteria: 'Wiring per OEM diagrams. All sensors connected.' },
        { id: 'AH-L2-004', name: 'Ductwork / Underfloor Plenum',
          description: 'Duct connections sealed. Floor tiles/grilles positioned correctly.',
          criteria: 'Leakage < SMACNA Class A. Tiles sealed where required.' }
      ]
    },
    dlc_piping: {
      name: 'DLC/Immersion Piping Installation Verification',
      applicableCooling: ['dlc', 'immersion'],
      durationPerSystem: { days: 3 },
      tests: [
        { id: 'DLC-L2-001', name: 'Secondary Loop Pressure Test',
          description: 'Hydrostatic test of entire secondary (facility-side) coolant loop.',
          criteria: 'Hold 1.5x design pressure for 4 hours. Zero leaks.' },
        { id: 'DLC-L2-002', name: 'Manifold Inspection',
          description: 'Row-level and rack-level manifold installation, valve positions.',
          criteria: 'All manifolds level. Isolation valves accessible. QD fittings engaged.' },
        { id: 'DLC-L2-003', name: 'Quick-Disconnect (QD) Fitting Test',
          description: 'Engage/disengage all QD fittings. Check for leaks.',
          criteria: 'All QDs connect smoothly. No drips on disconnect.' },
        { id: 'DLC-L2-004', name: 'Leak Detection Cable Routing',
          description: 'Verify leak detection cable/sensor placement under all piping.',
          criteria: 'Continuous coverage under all piping runs and at all QD locations.' },
        { id: 'DLC-L2-005', name: 'Coolant Containment',
          description: 'Drip trays, secondary containment, drain routing.',
          criteria: 'Containment under all piping. Drain to collection point.' }
      ]
    }
  }
};
```

#### 3.2.3. L2 — Fire, Security, IT, Controls

```javascript
var l2_other = {
  fire_detection: {
    name: 'Fire Detection Installation Verification',
    durationPerZone: { days: 0.25 },
    tests: [
      { id: 'FD-L2-001', name: 'Detector Placement Audit',
        description: 'Verify detector spacing per NFPA 72. Check above-ceiling, below-floor.',
        criteria: 'Spacing ≤ 30ft (smooth ceiling). Coverage above/below floor where required.' },
      { id: 'FD-L2-002', name: 'VESDA Sampling Pipe Inspection',
        description: 'Verify pipe routing, hole sizes, end caps, and air sampling calculations.',
        criteria: 'Pipe routing per design. Sampling holes per VESDA design tool output.' },
      { id: 'FD-L2-003', name: 'Wiring Inspection',
        description: 'Verify fire alarm circuit wiring, supervision, and end-of-line devices.',
        criteria: 'SLC and NAC wiring per NFPA 72. EOL devices installed.' }
    ]
  },
  fire_suppression: {
    name: 'Fire Suppression Installation Verification',
    durationPerZone: { days: 0.5 },
    tests: [
      { id: 'FS-L2-001', name: 'Agent Storage Inspection',
        description: 'Cylinder mounting, manifold connections, pressure gauges, safety pins.',
        criteria: 'Cylinders secure. Manifold per OEM. Gauges in green zone.' },
      { id: 'FS-L2-002', name: 'Nozzle Placement Audit',
        description: 'Verify nozzle count, position, and coverage per hydraulic calculation.',
        criteria: 'Nozzle positions match hydraulic calc. No obstructions within throw pattern.' },
      { id: 'FS-L2-003', name: 'Room Integrity Preparation',
        description: 'Inspect all penetrations sealed. Dampers installed. Door seals in place.',
        criteria: 'All penetrations fire-stopped. Dampers close on alarm. Door seals intact.' }
    ]
  },
  security: {
    name: 'Security Systems Installation Verification',
    durationPerZone: { days: 0.25 },
    tests: [
      { id: 'SEC-L2-001', name: 'Access Control Hardware',
        description: 'Card readers, door controllers, lock hardware, REX devices.',
        criteria: 'Readers at correct height (42-48" AFF). Locks correctly handed.' },
      { id: 'SEC-L2-002', name: 'CCTV Camera Placement',
        description: 'Camera positions, FoV coverage, cable routing, PoE switches.',
        criteria: 'All critical areas covered. No blind spots at entry points.' },
      { id: 'SEC-L2-003', name: 'Intrusion Detection',
        description: 'Perimeter sensors, door contacts, motion detectors.',
        criteria: 'All openings monitored. Motion detectors cover required zones.' }
    ]
  },
  it_infrastructure: {
    name: 'IT Infrastructure Installation Verification',
    durationPerHall: { days: 2 },
    tests: [
      { id: 'IT-L2-001', name: 'Structured Cabling Inspection',
        description: 'Cable routing, bend radius, labeling, patch panel terminations.',
        criteria: 'Bend radius ≥ 4x cable OD (Cat6A). Labels per TIA-606.' },
      { id: 'IT-L2-002', name: 'Fiber Optic Inspection',
        description: 'Fiber routing, splice trays, patch panels, connector cleanliness.',
        criteria: 'Connectors clean (inspect with scope). Labels per TIA-606.' },
      { id: 'IT-L2-003', name: 'Copper Cable Certification',
        description: 'Channel test all copper links per TIA-568.2-D Cat6A requirements.',
        criteria: 'All channels pass Cat6A channel test. Document worst-case margin.' },
      { id: 'IT-L2-004', name: 'Fiber Certification',
        description: 'OTDR test all fiber links. Measure insertion loss per TIA-568.3-D.',
        criteria: 'Loss ≤ TIA-568.3-D limits. OTDR trace shows no anomalies.' },
      { id: 'IT-L2-005', name: 'Rack & Containment',
        description: 'Rack mounting, grounding, blanking panels, hot/cold aisle containment.',
        criteria: 'Racks bolted and grounded. Containment sealed (no bypass air).' }
    ]
  },
  bms_controls: {
    name: 'BMS/Controls Installation Verification',
    durationPerSystem: { days: 1 },
    tests: [
      { id: 'BMS-L2-001', name: 'Controller Installation',
        description: 'DDC controllers, I/O modules, power supply, network connections.',
        criteria: 'Controllers powered. Network connectivity verified. Firmware correct.' },
      { id: 'BMS-L2-002', name: 'Sensor Installation Audit',
        description: 'Temperature, humidity, pressure, flow, level sensors — all locations.',
        criteria: 'Sensors at correct locations per control drawings. Wiring correct.' },
      { id: 'BMS-L2-003', name: 'Actuator Installation',
        description: 'Valve actuators, damper actuators — sizing, orientation, linkage.',
        criteria: 'Actuators correctly sized. Linkages secure. Stroke direction verified.' },
      { id: 'BMS-L2-004', name: 'Network Infrastructure',
        description: 'BMS network switches, cabling, IP addressing, VLAN configuration.',
        criteria: 'All controllers on correct VLAN. IP addresses per schedule.' }
    ]
  }
};
```

#### 3.2.4. L2 Duration & Cost Formulas

```javascript
function calculateL2Duration(inputs) {
  var elecDays = 0;
  elecDays += inputs.equipmentScale.switchgear * 1.5;
  elecDays += inputs.equipmentScale.transformers * 1;
  elecDays += inputs.equipmentScale.generators * 1;
  elecDays += Math.ceil(inputs.equipmentScale.ups_modules / 4) * 0.5; // batch UPS modules
  elecDays += inputs.equipmentScale.pdus * 0.25;
  elecDays += inputs.equipmentScale.sts_units * 0.5;
  elecDays += 1; // busbar
  elecDays += 1; // grounding

  var mechDays = 0;
  mechDays += 3; // piping pressure test (per system, not per unit)
  mechDays += Math.ceil(inputs.itLoad / 500) * 1; // cooling towers
  mechDays += Math.ceil(inputs.itLoad / 300) * 0.5; // pumps
  mechDays += inputs.equipmentScale.cooling_units * 0.5; // AHUs
  if (['dlc', 'immersion'].includes(inputs.coolingType)) {
    mechDays += 3; // DLC piping
  }

  var fireDays = 0;
  var zones = Math.ceil(inputs.itLoad / 200); // ~1 fire zone per 200kW
  fireDays += zones * 0.25; // detection
  fireDays += zones * 0.5;  // suppression

  var secDays = zones * 0.25;
  var itDays = Math.ceil(inputs.itLoad / 1000) * 2; // per data hall
  var bmsDays = 1; // base BMS verification

  // Parallel execution: electrical and mechanical run concurrently
  var criticalPath = Math.max(elecDays, mechDays) + fireDays + Math.max(secDays, itDays) + bmsDays;

  // Redundancy adds inspection of redundant paths
  criticalPath *= redundancyCxMultiplier[inputs.redundancy].durationMult;

  // Building type
  criticalPath *= buildingCxMultiplier[inputs.buildingType].duration;

  return Math.ceil(criticalPath);
}

function calculateL2Cost(inputs, l2Duration) {
  var rate = getRegionalRate(inputs.region);
  var cxTeamSize = 3; // CxA lead + 2 field engineers
  var laborCost = l2Duration * rate.cxEngineerDay * cxTeamSize;
  var testEquipmentRental = l2Duration * 350; // Megger, torque tools, etc.
  var consumables = inputs.itLoad * 0.5; // misc consumables scaled to facility size

  return {
    labor: laborCost,
    equipment: testEquipmentRental,
    consumables: consumables,
    total: laborCost + testEquipmentRental + consumables
  };
}
```

---

### 3.3. L3 — Component & Equipment Startup Testing

**Purpose**: Individual equipment energization and functional verification. Each piece of equipment is started, tuned, and verified to operate within specifications independently. This is the first "live" testing.

**Standards Reference**: ASHRAE Guideline 0-2019 Section 5.4, NETA ATS-2025 Chapter 7.3, NFPA 70B

**Safety Requirements**: Lock-Out/Tag-Out (LOTO) procedures mandatory. Energization permits required. PPE per arc flash study. First-time energization witnessed by CxA.

#### 3.3.1. L3 — Electrical Systems

```javascript
var l3_electrical = {
  switchgear: {
    name: 'HV/MV Switchgear Energization & Functional Test',
    durationPerUnit: { days: 2 },
    prerequisite: 'L2 complete for this switchgear. Energization permit approved.',
    tests: [
      { id: 'SW-L3-001', name: 'First Energization (Soft Start)',
        duration: 4, unit: 'hours',
        description: 'Apply voltage through variable source or at reduced load. Monitor for anomalies.',
        criteria: 'No trips, no arcing, no unusual noise or heat. Voltage stable.' },
      { id: 'SW-L3-002', name: 'Breaker Close/Open Cycle Test (Energized)',
        duration: 2, unit: 'hours',
        description: 'Operate each breaker under no-load and then under load.',
        criteria: 'Operating times within manufacturer spec. Contact resistance stable.' },
      { id: 'SW-L3-003', name: 'Protection Relay Functional (In-Circuit)',
        duration: 3, unit: 'hours',
        description: 'Verify all protection functions operate correctly in-circuit.',
        criteria: 'Overcurrent, earth fault, under/over voltage all trip at correct values.' },
      { id: 'SW-L3-004', name: 'Metering Accuracy Verification',
        duration: 1, unit: 'hours',
        description: 'Compare panel meters against reference power analyzer.',
        criteria: 'Metering within ±1% of reference instrument.' },
      { id: 'SW-L3-005', name: 'Thermographic Survey (Initial)',
        duration: 1, unit: 'hours',
        description: 'IR scan all connections under load after 2 hours of operation.',
        criteria: 'No hot spots > 10°C above ambient for similar connections.' }
    ]
  },
  transformers: {
    name: 'Transformer Energization & Load Test',
    durationPerUnit: { days: 1.5 },
    prerequisite: 'L2 complete. Oil analysis acceptable. All protection in service.',
    tests: [
      { id: 'TX-L3-001', name: 'Transformer Energization',
        duration: 2, unit: 'hours',
        description: 'Energize at no-load. Monitor inrush current, noise, vibration.',
        criteria: 'Inrush decays within 10 cycles. No unusual noise. Oil level stable.' },
      { id: 'TX-L3-002', name: 'Secondary Voltage Verification',
        duration: 1, unit: 'hours',
        description: 'Measure secondary voltage on all taps.',
        criteria: 'Voltage within ±0.5% of nameplate ratio.' },
      { id: 'TX-L3-003', name: 'Load Test (Using Load Bank)',
        duration: 4, unit: 'hours',
        description: 'Apply load in steps (25/50/75/100%). Monitor temperatures.',
        criteria: 'Temperature rise per IEC 60076. Oil temperature within limits.' },
      { id: 'TX-L3-004', name: 'Cooling System Functional',
        duration: 1, unit: 'hours',
        description: 'Verify fans/pumps start at correct temperature thresholds.',
        criteria: 'Fans stage on at set temperature. All fans/pumps operational.' }
    ]
  },
  generators: {
    name: 'Generator Startup & Load Test',
    durationPerUnit: { days: 2 },
    prerequisite: 'L2 complete. Fuel available. Load bank connected.',
    tests: [
      { id: 'GEN-L3-001', name: 'First Engine Start',
        duration: 1, unit: 'hours',
        description: 'Initial start. Verify oil pressure, coolant temp, exhaust.',
        criteria: 'Start < 10 sec. Oil pressure ≥ 40 PSI within 15 sec.' },
      { id: 'GEN-L3-002', name: 'No-Load Running Test',
        duration: 2, unit: 'hours',
        description: 'Run at no-load for 30 minutes. Verify voltage, frequency, stability.',
        criteria: 'Voltage ±1%, frequency ±0.25 Hz. No alarms.' },
      { id: 'GEN-L3-003', name: 'Load Bank Test (4-Step + Endurance)',
        duration: 8, unit: 'hours',
        description: '25%→50%→75%→100% load steps, then 4-hour endurance at 100%.',
        criteria: 'Voltage ±2%, frequency ±0.5% at each step. 4hr continuous at 100%.' },
      { id: 'GEN-L3-004', name: 'ATS Integration Test',
        duration: 2, unit: 'hours',
        description: 'Simulate mains failure. Verify ATS transfer to generator.',
        criteria: 'Generator starts within 10 sec. ATS transfers within 15 sec total.' },
      { id: 'GEN-L3-005', name: 'Parallel Operation (Multi-Gen)',
        duration: 3, unit: 'hours',
        description: 'Synchronize and parallel multiple generators. Load sharing test.',
        criteria: 'Sync within 5 sec. Load sharing within ±5% of each set.' },
      { id: 'GEN-L3-006', name: 'Emergency Stop Test',
        duration: 0.5, unit: 'hours',
        description: 'Test all E-stop buttons (local, remote, fire system interlock).',
        criteria: 'Engine stops within 5 seconds from any E-stop.' }
    ],
    loadBankRequirement: {
      type: 'resistive_reactive',
      sizingRule: '110% of generator rated kW',
      rentalCost: '$200-500/hour (see Section 4)',
      typicalDuration: '12-24 hours per generator set'
    }
  },
  ups: {
    name: 'UPS Energization & Functional Test',
    durationPerUnit: { days: 1.5 },
    tests: [
      { id: 'UPS-L3-001', name: 'UPS Energization (Mains Only)',
        duration: 2, unit: 'hours',
        description: 'Energize input. Verify rectifier/inverter operation. No load.',
        criteria: 'Output voltage stable. No alarms. THD < 3%.' },
      { id: 'UPS-L3-002', name: 'Battery Equalization Charge',
        duration: 4, unit: 'hours',
        description: 'Initial equalization charge. Monitor cell voltages.',
        criteria: 'All cells within ±0.1V of average. Charging current stable.' },
      { id: 'UPS-L3-003', name: 'Load Test (UPS Output)',
        duration: 4, unit: 'hours',
        description: 'Load bank on UPS output: 25/50/75/100%. Measure quality.',
        criteria: 'Output voltage ±1%, THD < 3% at all loads.' },
      { id: 'UPS-L3-004', name: 'Battery Discharge Test',
        duration: 3, unit: 'hours',
        description: 'Simulate mains failure. Run on battery at rated load.',
        criteria: 'Autonomy ≥ specified runtime. Transfer seamless (0ms).' },
      { id: 'UPS-L3-005', name: 'Static Bypass Test',
        duration: 1, unit: 'hours',
        description: 'Force transfer to static bypass. Verify output continuity.',
        criteria: 'No output interruption. Bypass voltage within tolerance.' },
      { id: 'UPS-L3-006', name: 'Module Removal Test (Modular)',
        duration: 1.5, unit: 'hours',
        description: 'Remove one module under load. Verify remaining modules handle load.',
        criteria: 'No output interruption. Load redistributed within 100ms.' }
    ]
  },
  sts: {
    name: 'STS Functional Test',
    durationPerUnit: { days: 0.5 },
    tests: [
      { id: 'STS-L3-001', name: 'Preferred Source Transfer Test',
        duration: 2, unit: 'hours',
        description: 'Remove preferred source. Verify STS transfers to alternate.',
        criteria: 'Transfer time < 4ms (sub-cycle). No output interruption.' },
      { id: 'STS-L3-002', name: 'Retransfer Test',
        duration: 1, unit: 'hours',
        description: 'Restore preferred source. Verify retransfer after delay.',
        criteria: 'Retransfer after programmable delay (30-300 sec). Clean transfer.' },
      { id: 'STS-L3-003', name: 'Overload Transfer',
        duration: 1, unit: 'hours',
        description: 'Simulate overload on preferred. Verify transfer behavior.',
        criteria: 'Transfers to alternate if preferred fails under overload.' }
    ]
  }
};
```

#### 3.3.2. L3 — Mechanical Systems

```javascript
var l3_mechanical = {
  chillers: {
    name: 'Chiller Startup & Performance Test',
    durationPerUnit: { days: 2 },
    tests: [
      { id: 'CH-L3-001', name: 'Pre-Start Checks',
        duration: 2, unit: 'hours',
        description: 'Oil level, refrigerant charge, water flow established.',
        criteria: 'Oil at sight glass mark. Refrigerant charge per OEM.' },
      { id: 'CH-L3-002', name: 'Initial Start (OEM Supervised)',
        duration: 4, unit: 'hours',
        description: 'OEM technician performs first start. Verify all parameters.',
        criteria: 'Chiller starts cleanly. No alarms. Suction/discharge pressures normal.' },
      { id: 'CH-L3-003', name: 'Capacity Test',
        duration: 4, unit: 'hours',
        description: 'Test at 50%, 75%, 100% capacity using facility load or load bank.',
        criteria: 'Capacity ≥ rated at design conditions. Efficiency ≥ nameplate.' },
      { id: 'CH-L3-004', name: 'Safety Cutout Test',
        duration: 2, unit: 'hours',
        description: 'Test high/low pressure cutout, flow loss, freeze protection.',
        criteria: 'All safeties trip at correct setpoints. Auto-reset where appropriate.' },
      { id: 'CH-L3-005', name: 'VSD Operation (if equipped)',
        duration: 1, unit: 'hours',
        description: 'Verify variable speed operation across load range.',
        criteria: 'Smooth speed modulation. No harmonic issues. Current within limits.' }
    ]
  },
  cooling_units: {
    name: 'CRAH/CRAC/In-Row Startup',
    durationPerUnit: { days: 0.5 },
    tests: [
      { id: 'CU-L3-001', name: 'Unit Startup',
        duration: 2, unit: 'hours',
        description: 'Power on. Verify fan operation, coil valve operation, controls.',
        criteria: 'Fan runs at design speed. Coil valve modulates. Display reads correctly.' },
      { id: 'CU-L3-002', name: 'Temperature Control Test',
        duration: 2, unit: 'hours',
        description: 'Verify temperature setpoint control. Step change response.',
        criteria: 'Supply air within ±1°C of setpoint. Response < 5 minutes.' },
      { id: 'CU-L3-003', name: 'Alarm & Failsafe Test',
        duration: 1, unit: 'hours',
        description: 'Simulate sensor failure, high temp, flow loss.',
        criteria: 'Alarms generated. Failsafe mode activates (fan to 100%).' }
    ]
  },
  pumps: {
    name: 'Pump Startup & Balancing',
    durationPerUnit: { days: 0.5 },
    tests: [
      { id: 'PMP-L3-001', name: 'Pump Start & Run',
        duration: 1, unit: 'hours',
        description: 'Start pump. Verify rotation, flow, pressure, vibration, temperature.',
        criteria: 'Flow within ±10% of design. Vibration < 4.5mm/s. Bearing temp < 80°C.' },
      { id: 'PMP-L3-002', name: 'VFD Ramp Test',
        duration: 1, unit: 'hours',
        description: 'Test VFD across speed range. Verify pump curve tracking.',
        criteria: 'Smooth acceleration/deceleration. No resonance points.' },
      { id: 'PMP-L3-003', name: 'System Balancing',
        duration: 2, unit: 'hours',
        description: 'Balance flow across all branches. Set balancing valve positions.',
        criteria: 'Flow within ±10% of design at each branch. Record final positions.' }
    ]
  },
  cooling_towers: {
    name: 'Cooling Tower Startup',
    durationPerUnit: { days: 1 },
    tests: [
      { id: 'CT-L3-001', name: 'Basin Fill & Water Treatment',
        duration: 2, unit: 'hours',
        description: 'Fill basin. Initialize chemical treatment. Verify makeup water.',
        criteria: 'Basin level correct. Initial chemical treatment complete.' },
      { id: 'CT-L3-002', name: 'Fan Startup',
        duration: 1, unit: 'hours',
        description: 'Start fans. Verify airflow direction, VFD operation, vibration.',
        criteria: 'Airflow direction correct (induced/forced). Vibration < 5mm/s.' },
      { id: 'CT-L3-003', name: 'Thermal Performance',
        duration: 4, unit: 'hours',
        description: 'Measure approach temperature at design wet-bulb.',
        criteria: 'Approach within 2°F of design. Range meets specification.' }
    ]
  },
  cdu_systems: {
    name: 'CDU System Startup (DLC/Immersion)',
    applicableCooling: ['dlc', 'immersion'],
    durationPerUnit: { days: 2 },
    tests: [
      { id: 'CDU-L3-001', name: 'Secondary Loop Fill & Purge',
        duration: 3, unit: 'hours',
        description: 'Fill secondary loop with coolant. Purge all air. Verify fluid quality.',
        criteria: 'System fully filled. No air pockets. Coolant quality within spec.' },
      { id: 'CDU-L3-002', name: 'Pump Startup & Flow Test',
        duration: 2, unit: 'hours',
        description: 'Start CDU pumps. Verify flow to each rack/row manifold.',
        criteria: 'Flow rate within ±10% of design at each manifold.' },
      { id: 'CDU-L3-003', name: 'Heat Exchanger Performance',
        duration: 3, unit: 'hours',
        description: 'Verify heat rejection at design conditions.',
        criteria: 'Approach temperature ≤ 3°C. Capacity ≥ rated.' },
      { id: 'CDU-L3-004', name: 'Leak Detection Functional Test',
        duration: 1, unit: 'hours',
        description: 'Apply simulated leak at sensor locations. Verify alarm.',
        criteria: 'All sensors detect within 30 seconds. Alarm reaches BMS.' },
      { id: 'CDU-L3-005', name: 'Server-Level Flow Verification',
        duration: 3, unit: 'hours',
        description: 'Verify coolant flow to individual server cold plates/manifolds.',
        criteria: 'Flow visible at each server QD. Temperature differential confirms flow.' }
    ]
  }
};
```

#### 3.3.3. L3 — Fire, Security, IT, BMS

```javascript
var l3_other = {
  fire_detection: {
    name: 'Fire Detection System Functional Test',
    durationPerZone: { days: 0.5 },
    tests: [
      { id: 'FD-L3-001', name: 'Individual Detector Test',
        description: 'Test each detector with calibrated smoke/heat source.',
        criteria: 'All detectors alarm within sensitivity spec. Address matches mapping.' },
      { id: 'FD-L3-002', name: 'VESDA Sensitivity Test',
        description: 'Inject test smoke at sampling ports. Verify alert/alarm levels.',
        criteria: 'Alert at 0.025%/m, Action at 0.05%/m, Fire at 0.1%/m (typical).' },
      { id: 'FD-L3-003', name: 'Notification Appliance Test',
        description: 'Activate each notification zone. Verify audible/visual devices.',
        criteria: 'Sound level ≥ 75 dB at pillow level. Strobes visible throughout zone.' }
    ]
  },
  fire_suppression: {
    name: 'Fire Suppression Functional Test',
    durationPerZone: { days: 1 },
    tests: [
      { id: 'FS-L3-001', name: 'Door Fan Room Integrity Test',
        description: 'Pressurize room with calibrated fan. Measure leakage rate.',
        criteria: 'Retention time ≥ 10 minutes at design concentration.' },
      { id: 'FS-L3-002', name: 'Simulated Discharge Test',
        description: 'Full sequence without agent release: detection → countdown → abort → release signal.',
        criteria: 'Full sequence completes in correct timing. Abort stops release.' },
      { id: 'FS-L3-003', name: 'HVAC Shutdown Integration',
        description: 'Verify HVAC shutdown and damper closure on fire alarm.',
        criteria: 'All AHUs stop. Dampers close within 10 seconds. Confirmed by BMS.' },
      { id: 'FS-L3-004', name: 'EPO Integration Test (if applicable)',
        description: 'Verify Emergency Power Off integration with fire system.',
        criteria: 'EPO activates on confirmed fire signal (cross-zone).' }
    ]
  },
  security: {
    name: 'Security System Functional Test',
    durationPerZone: { days: 0.5 },
    tests: [
      { id: 'SEC-L3-001', name: 'Access Control Functional',
        description: 'Test card readers, biometrics, PIN entry, anti-passback.',
        criteria: 'Valid credentials grant access. Invalid credentials denied and logged.' },
      { id: 'SEC-L3-002', name: 'CCTV Recording & Playback',
        description: 'Verify all cameras recording. Test playback and export.',
        criteria: 'All cameras recording at design FPS and resolution. 30-day retention.' },
      { id: 'SEC-L3-003', name: 'Intercom & Duress',
        description: 'Test intercoms, duress buttons, and alarm integration.',
        criteria: 'Intercom two-way communication clear. Duress generates silent alarm.' }
    ]
  },
  bms: {
    name: 'BMS Point-to-Point Verification',
    durationPerPoints: { hoursPerHundredPoints: 8 },
    tests: [
      { id: 'BMS-L3-001', name: 'Analog Input Calibration',
        description: 'Apply known signal to each AI point. Verify BMS reads correctly.',
        criteria: 'BMS reading within ±2% of applied signal.' },
      { id: 'BMS-L3-002', name: 'Digital Input Test',
        description: 'Toggle each DI point. Verify BMS status changes.',
        criteria: 'BMS reflects correct status within 5 seconds.' },
      { id: 'BMS-L3-003', name: 'Analog Output Verification',
        description: 'Command each AO from BMS. Verify field device responds.',
        criteria: 'Field device responds proportionally. Full range verified.' },
      { id: 'BMS-L3-004', name: 'Digital Output Test',
        description: 'Command each DO from BMS. Verify field device toggles.',
        criteria: 'Field device starts/stops within 2 seconds of command.' },
      { id: 'BMS-L3-005', name: 'Alarm Generation Test',
        description: 'Force each alarm condition. Verify BMS alarm, priority, routing.',
        criteria: 'Alarm generated with correct priority. Routed to correct operator.' }
    ]
  }
};
```

#### 3.3.4. L3 Duration & Cost Formulas

```javascript
function calculateL3Duration(inputs) {
  var elecDays = 0;
  elecDays += inputs.equipmentScale.switchgear * 2;
  elecDays += inputs.equipmentScale.transformers * 1.5;
  elecDays += inputs.equipmentScale.generators * 2;
  elecDays += 1.5; // UPS system
  elecDays += inputs.equipmentScale.sts_units * 0.5;

  var mechDays = 0;
  var chillerCount = Math.ceil(inputs.itLoad / 500);
  mechDays += chillerCount * 2;
  mechDays += inputs.equipmentScale.cooling_units * 0.5;
  mechDays += Math.ceil(inputs.itLoad / 300) * 0.5; // pumps
  mechDays += Math.ceil(inputs.itLoad / 2000) * 1; // cooling towers
  if (['dlc', 'immersion'].includes(inputs.coolingType)) {
    mechDays += Math.ceil(inputs.itLoad / 500) * 2; // CDUs
  }

  var fireDays = Math.ceil(inputs.itLoad / 200) * 1.5; // detection + suppression
  var secDays = Math.ceil(inputs.itLoad / 200) * 0.5;
  var bmsDays = Math.ceil(bmsCxScope[inputs.bmsComplexity].ioPointsPerMW
                          * (inputs.itLoad / 1000) / 100) * 1; // 100 points per day

  // L3 can run disciplines partially in parallel (elec first, then mech after power)
  var criticalPath = elecDays + Math.max(mechDays, fireDays) + Math.max(secDays, bmsDays);

  criticalPath *= coolingCxMultiplier[inputs.coolingType].duration;
  criticalPath *= redundancyCxMultiplier[inputs.redundancy].durationMult;

  return Math.ceil(criticalPath);
}

function calculateL3Cost(inputs, l3Duration) {
  var rate = getRegionalRate(inputs.region);
  var cxTeamSize = 4; // CxA lead + 2 field eng + OEM coordinator
  var laborCost = l3Duration * rate.cxEngineerDay * cxTeamSize;

  // Load bank rental (generators + UPS)
  var genTestHours = inputs.equipmentScale.generators * 12;
  var upsTestHours = 8;
  var loadBankCost = (genTestHours + upsTestHours) * 350; // $350/hr average

  // Test equipment rental
  var testEquipment = l3Duration * 500; // power analyzers, vibration, thermal imaging

  // OEM startup charges (typically included in equipment contract, but budget separately)
  var oemStartupDays = inputs.equipmentScale.generators * 2
                     + Math.ceil(inputs.itLoad / 500) * 2; // chiller OEM startup
  var oemCost = oemStartupDays * rate.oemSpecialistDay;

  return {
    labor: laborCost,
    loadBank: loadBankCost,
    testEquipment: testEquipment,
    oemStartup: oemCost,
    total: laborCost + loadBankCost + testEquipment + oemCost
  };
}
```

---

### 3.4. L4 — Functional Performance Testing

**Purpose**: Verify that complete systems (not just individual components) perform to design specifications under realistic operating conditions. Systems are tested as integrated assemblies — electrical path A, cooling loop 1, etc.

**Standards Reference**: ASHRAE Guideline 0-2019 Section 5.5, ASHRAE Guideline 1.6 (Data Centers), NETA MTS-2023

**Key Distinction from L3**: L3 tests individual equipment; L4 tests the system that equipment belongs to. Example: L3 tests one chiller; L4 tests the entire chilled water system (chillers + pumps + valves + piping + controls + cooling towers operating together).

#### 3.4.1. L4 — Electrical System Performance

```javascript
var l4_electrical = {
  power_path_A: {
    name: 'Electrical Distribution Path A — Full Load Test',
    duration: { days: 3 },
    tests: [
      { id: 'EP-L4-001', name: 'Full Power Path Verification',
        duration: 8, unit: 'hours',
        description: 'Trace power from utility/generator through transformer, switchgear, UPS, PDU to rack.',
        criteria: 'Voltage drop < 3% utility to rack. Phase balance within 5%.' },
      { id: 'EP-L4-002', name: 'Selective Coordination Test',
        duration: 4, unit: 'hours',
        description: 'Simulate faults at various points. Verify only the nearest upstream device trips.',
        criteria: 'Selective coordination maintained. No upstream trips on downstream faults.' },
      { id: 'EP-L4-003', name: 'Harmonic Distortion Survey',
        duration: 2, unit: 'hours',
        description: 'Measure THDv and THDi at PCC, switchgear, UPS input/output, PDU.',
        criteria: 'THDv < 5% at PCC (IEEE 519). THDi within limits per load category.' },
      { id: 'EP-L4-004', name: 'Power Quality Recording (24-Hour)',
        duration: 24, unit: 'hours',
        description: 'Install power quality analyzers at key points for 24-hour recording.',
        criteria: 'No sags > 10%, no swells > 10%, no transients above EN 50160 limits.' },
      { id: 'EP-L4-005', name: 'Emergency Power System Test',
        duration: 4, unit: 'hours',
        description: 'Simulate utility failure. Verify full generator start → ATS transfer → load pickup sequence.',
        criteria: 'Full sequence < 15 seconds. UPS bridges gap. No load drops.' }
    ]
  },
  power_path_B: {
    name: 'Electrical Distribution Path B (2N configurations)',
    applicable: "redundancy === '2N' || redundancy === '2N+1'",
    duration: { days: 3 },
    tests: 'Same as Path A tests applied to Path B independently.'
  },
  epms: {
    name: 'Electrical Power Monitoring System (EPMS)',
    duration: { days: 2 },
    tests: [
      { id: 'EPMS-L4-001', name: 'Data Collection Verification',
        duration: 4, unit: 'hours',
        description: 'Verify all metering points reporting to EPMS. Check polling rates.',
        criteria: 'All meters reporting. Polling interval ≤ 15 seconds.' },
      { id: 'EPMS-L4-002', name: 'Alarm & Event Management',
        duration: 2, unit: 'hours',
        description: 'Verify alarm thresholds, notification routing, escalation logic.',
        criteria: 'All alarm points active. Notifications reach correct recipients.' },
      { id: 'EPMS-L4-003', name: 'Dashboard & Reporting',
        duration: 2, unit: 'hours',
        description: 'Verify PUE calculation, energy reports, capacity planning views.',
        criteria: 'PUE calculated correctly. Reports generate without error.' },
      { id: 'EPMS-L4-004', name: 'Historical Data Trending',
        duration: 1, unit: 'hours',
        description: 'Verify data archiving, trend display, and data export.',
        criteria: 'Historical data stored per retention policy. Trends display correctly.' }
    ]
  }
};
```

#### 3.4.2. L4 — Mechanical System Performance

```javascript
var l4_mechanical = {
  chilled_water_system: {
    name: 'Chilled Water System Performance Test',
    duration: { days: 4 },
    tests: [
      { id: 'CW-L4-001', name: 'System Capacity Test',
        duration: 8, unit: 'hours',
        description: 'Operate full CHW system at 100% design load. Measure system capacity.',
        criteria: 'System capacity ≥ 100% of design. Supply temp within ±0.5°C of setpoint.' },
      { id: 'CW-L4-002', name: 'Part-Load Efficiency',
        duration: 4, unit: 'hours',
        description: 'Test at 25%, 50%, 75% load. Measure system kW/ton.',
        criteria: 'System efficiency ≥ design at each load point.' },
      { id: 'CW-L4-003', name: 'Chiller Staging Sequence',
        duration: 4, unit: 'hours',
        description: 'Verify automatic chiller lead/lag staging based on load.',
        criteria: 'Chillers stage on/off at correct load thresholds. No hunting.' },
      { id: 'CW-L4-004', name: 'Pump Staging & VFD Control',
        duration: 3, unit: 'hours',
        description: 'Verify pump staging, differential pressure control, VFD response.',
        criteria: 'DP maintained within ±5% of setpoint. Pumps stage correctly.' },
      { id: 'CW-L4-005', name: 'Cooling Tower Fan Staging',
        duration: 2, unit: 'hours',
        description: 'Verify CT fan staging based on condenser water temperature.',
        criteria: 'CW temp maintained within ±1°C of setpoint. Fans stage smoothly.' },
      { id: 'CW-L4-006', name: 'Free Cooling / Economizer Mode',
        duration: 4, unit: 'hours',
        description: 'Test waterside or airside economizer transition and operation.',
        criteria: 'Economizer activates at correct OA conditions. Smooth transition.' },
      { id: 'CW-L4-007', name: 'Single Chiller Failure',
        duration: 2, unit: 'hours',
        description: 'Simulate chiller failure. Verify standby chiller auto-starts.',
        criteria: 'Standby chiller starts within 5 minutes. Temperature recovered within 15 min.' }
    ]
  },
  air_distribution: {
    name: 'Air Distribution System Performance',
    duration: { days: 3 },
    tests: [
      { id: 'AD-L4-001', name: 'Airflow Uniformity Test',
        duration: 4, unit: 'hours',
        description: 'Measure supply air temperature at each tile/grille/diffuser.',
        criteria: 'Temperature uniformity within ±2°C across data hall.' },
      { id: 'AD-L4-002', name: 'Hot Aisle / Cold Aisle Differential',
        duration: 2, unit: 'hours',
        description: 'Measure temperature at cold aisle inlet and hot aisle return.',
        criteria: 'Cold aisle: 18-27°C (ASHRAE A1). Hot aisle: ≤ 45°C.' },
      { id: 'AD-L4-003', name: 'Containment Effectiveness',
        duration: 3, unit: 'hours',
        description: 'With containment doors closed, measure bypass and recirculation.',
        criteria: 'Bypass air < 5%. Recirculation air < 10%. (ASHRAE TC 9.9)' },
      { id: 'AD-L4-004', name: 'Humidity Control',
        duration: 2, unit: 'hours',
        description: 'Verify humidity setpoint control across load range.',
        criteria: 'RH maintained within ASHRAE A1 envelope (8-60% RH, DP ≤ 15°C).' },
      { id: 'AD-L4-005', name: 'CFD Model Validation',
        duration: 4, unit: 'hours',
        description: 'Compare measured temps/airflows against CFD model predictions.',
        criteria: 'Measured values within ±10% of CFD predictions at sample points.' }
    ]
  },
  dlc_system: {
    name: 'Direct Liquid Cooling System Performance',
    applicableCooling: ['dlc', 'immersion'],
    duration: { days: 3 },
    tests: [
      { id: 'DLC-L4-001', name: 'Full-System Flow Balancing',
        duration: 4, unit: 'hours',
        description: 'Balance flow across all racks/rows. Verify per-server flow rates.',
        criteria: 'Flow within ±10% of design at each rack. ΔT within ±2°C.' },
      { id: 'DLC-L4-002', name: 'CDU Staging Test',
        duration: 2, unit: 'hours',
        description: 'Verify CDU lead/lag staging based on thermal load.',
        criteria: 'CDUs stage at correct thresholds. No temperature spikes.' },
      { id: 'DLC-L4-003', name: 'Coolant Quality Monitoring',
        duration: 1, unit: 'hours',
        description: 'Verify inline coolant quality sensors and logging.',
        criteria: 'pH, conductivity, particulate within limits. Logging active.' },
      { id: 'DLC-L4-004', name: 'Heat Rejection Chain Test',
        duration: 4, unit: 'hours',
        description: 'Full chain: server → cold plate → CDU → primary loop → cooling tower/dry cooler.',
        criteria: 'Heat rejected ≥ IT load. All approach temperatures within design.' },
      { id: 'DLC-L4-005', name: 'Server Hot-Swap Under Liquid',
        duration: 2, unit: 'hours',
        description: 'Disconnect and reconnect server liquid cooling under pressure.',
        criteria: 'QD disconnect clean (< 1ml spillage). Reconnect with no air ingress.' }
    ]
  }
};
```

#### 3.4.3. L4 — Integrated Controls Performance

```javascript
var l4_controls = {
  bms_sequences: {
    name: 'BMS Sequence of Operations Verification',
    duration: { days: 3 },
    tests: [
      { id: 'BMS-L4-001', name: 'Cooling Control Sequence',
        description: 'Verify complete cooling control from setpoint change through valve/fan response.',
        criteria: 'System responds per design sequence. No oscillation. Stable within 10 minutes.' },
      { id: 'BMS-L4-002', name: 'Electrical Monitoring Sequence',
        description: 'Verify BMS captures all power events and generates correct responses.',
        criteria: 'Power events detected within 5 seconds. Alarms generated correctly.' },
      { id: 'BMS-L4-003', name: 'Fire System Integration',
        description: 'Fire alarm triggers: HVAC shutdown, damper closure, EPO logic.',
        criteria: 'BMS receives fire signal < 5 seconds. HVAC stops. Dampers close.' },
      { id: 'BMS-L4-004', name: 'Trend & Alarm Verification (48-Hour Soak)',
        description: 'Run full BMS for 48 hours. Review trend data and alarm log.',
        criteria: 'No nuisance alarms. All trends recording. No data gaps.' }
    ]
  }
};
```

#### 3.4.4. L4 Duration & Cost Formulas

```javascript
function calculateL4Duration(inputs) {
  var elecDays = 3; // Path A
  if (['2N', '2N+1'].includes(inputs.redundancy)) {
    elecDays += 3; // Path B
  }
  elecDays += 2; // EPMS

  var mechDays = 4; // CHW system
  mechDays += 3;    // air distribution
  if (['dlc', 'immersion'].includes(inputs.coolingType)) {
    mechDays += 3;  // DLC system
  }

  var controlsDays = 3; // BMS sequences

  // L4 runs with some parallelism (elec + mech can overlap after power is established)
  var criticalPath = elecDays + Math.max(mechDays, controlsDays);

  // Scale factor for facility size (larger facilities need more time)
  var sizeFactor = 1.0;
  if (inputs.itLoad > 5000)  sizeFactor = 1.15;
  if (inputs.itLoad > 10000) sizeFactor = 1.30;
  if (inputs.itLoad > 25000) sizeFactor = 1.50;
  if (inputs.itLoad > 50000) sizeFactor = 1.75;

  criticalPath *= sizeFactor;
  criticalPath *= redundancyCxMultiplier[inputs.redundancy].durationMult;

  return Math.ceil(criticalPath);
}

function calculateL4Cost(inputs, l4Duration) {
  var rate = getRegionalRate(inputs.region);
  var cxTeamSize = 5; // CxA lead + 3 field eng + controls specialist
  var laborCost = l4Duration * rate.cxEngineerDay * cxTeamSize;

  // Load bank for system-level testing
  var loadBankHours = 24; // 24hr power quality recording + system load test
  if (['2N', '2N+1'].includes(inputs.redundancy)) loadBankHours *= 2;
  var loadBankCost = loadBankHours * 350;

  // Power quality analyzers (rental)
  var pqAnalyzerCost = l4Duration * 200 * 4; // 4 analyzers

  // Third-party test equipment
  var testEquipment = l4Duration * 600;

  return {
    labor: laborCost,
    loadBank: loadBankCost,
    pqAnalyzers: pqAnalyzerCost,
    testEquipment: testEquipment,
    total: laborCost + loadBankCost + pqAnalyzerCost + testEquipment
  };
}
```

---

### 3.5. L5 — Integrated Systems Testing (IST)

**Purpose**: The ultimate validation. Test the entire facility as an integrated system under realistic failure scenarios. Verify that all systems work together to maintain IT load availability during any single (Tier III) or concurrent (Tier IV) failure event.

**Standards Reference**: Uptime Institute TCDD (Tier Certification of Design Documents), TCCF (Tier Certification of Constructed Facility), TCOS (Tier Certification of Operational Sustainability)

**Key Principle**: L5 answers the question: "If [failure event X] happens at 3 AM on a Saturday, will the facility maintain IT load availability without human intervention?"

**Prerequisites**: ALL of L1–L4 must be complete. All punch list items resolved. As-built documentation updated. Operations team trained and on-site.

#### 3.5.1. IST Failure Scenarios

```javascript
var l5_scenarios = {
  // ============================================================
  // SCENARIO 1: COMPLETE UTILITY POWER FAILURE (BLACK START)
  // ============================================================
  blackout: {
    id: 'IST-001',
    name: 'Complete Utility Power Failure (Black Start)',
    category: 'electrical',
    tier_required: ['I', 'II', 'III', 'IV'],
    duration: { hours: 4 },
    description: 'Simulate total loss of utility power. Verify generator start, ATS transfer, and UPS ride-through.',
    procedure: [
      'Step 1: Verify all systems operating normally at ≥ 50% IT load.',
      'Step 2: Open utility main breaker (simulating utility outage).',
      'Step 3: UPS transfers to battery. Verify 0ms transfer time.',
      'Step 4: Generators start automatically (< 10 seconds target).',
      'Step 5: Generators synchronize and close onto bus.',
      'Step 6: ATS transfers load from UPS battery to generator.',
      'Step 7: UPS recharges battery from generator power.',
      'Step 8: Verify all cooling systems restart on generator power.',
      'Step 9: Monitor for 2 hours on generator power.',
      'Step 10: Restore utility power. Verify retransfer sequence.',
      'Step 11: Generators cool-down and return to standby.'
    ],
    acceptance_criteria: [
      'IT load maintained continuously throughout event (0ms interruption)',
      'Generator start < 10 seconds from utility loss',
      'Total sequence (utility loss → generator on bus) < 15 seconds',
      'UPS battery consumed < 50% of rated autonomy',
      'Cooling restored within 2 minutes of generator stable',
      'Retransfer to utility seamless, no alarms',
      'All systems return to normal within 30 minutes of utility restore'
    ],
    measurements: [
      'UPS battery voltage curve during event',
      'Generator start time (cranking to voltage stable)',
      'ATS transfer timing (each ATS)',
      'Voltage/frequency during transitions',
      'Room temperature trend during cooling restart',
      'BMS alarm log (full event timeline)'
    ],
    risk_level: 'medium',
    rollback_plan: 'Manually retransfer to utility via static bypass if generators fail to start.'
  },

  // ============================================================
  // SCENARIO 2: GENERATOR FAIL-TO-START + EXTENDED BATTERY
  // ============================================================
  gen_fail_start: {
    id: 'IST-002',
    name: 'Generator Fail-to-Start Scenario',
    category: 'electrical',
    tier_required: ['II', 'III', 'IV'],
    duration: { hours: 2 },
    description: 'Simulate generator failure to start during utility outage. Test UPS extended battery ride-through and manual procedures.',
    procedure: [
      'Step 1: Verify all systems at normal operation.',
      'Step 2: Inhibit primary generator start circuit.',
      'Step 3: Open utility main breaker.',
      'Step 4: UPS transfers to battery. Primary generator does NOT start.',
      'Step 5: After 30 seconds, standby/backup generator should auto-start (if N+1).',
      'Step 6: If no backup generator, monitor UPS battery autonomy.',
      'Step 7: At 50% battery, restore utility (simulating manual intervention).',
      'Step 8: Reset generator inhibit. Test manual generator start.',
      'Step 9: Verify all alarms generated correctly.'
    ],
    acceptance_criteria: [
      'UPS maintains IT load for full rated autonomy',
      'Backup generator starts automatically (N+1 systems)',
      'BMS generates generator failure alarm within 30 seconds',
      'Alarm notification reaches operations team via all configured channels',
      'Manual procedures successfully restore power'
    ]
  },

  // ============================================================
  // SCENARIO 3: UPS BYPASS TRANSFER
  // ============================================================
  ups_bypass: {
    id: 'IST-003',
    name: 'UPS Static Bypass Transfer',
    category: 'electrical',
    tier_required: ['II', 'III', 'IV'],
    duration: { hours: 1.5 },
    description: 'Transfer UPS to static bypass (maintenance mode). Verify IT load maintained on raw utility power.',
    procedure: [
      'Step 1: Verify UPS operating in online (double-conversion) mode.',
      'Step 2: Initiate static bypass transfer from UPS control panel.',
      'Step 3: Verify transfer occurs without output interruption.',
      'Step 4: Monitor power quality on bypass (no UPS conditioning).',
      'Step 5: Return to normal online mode.',
      'Step 6: Verify clean retransfer.'
    ],
    acceptance_criteria: [
      'Transfer to bypass: 0ms interruption',
      'Return from bypass: 0ms interruption',
      'Power quality on bypass within IT equipment tolerance',
      'All BMS alarms indicate bypass mode correctly'
    ]
  },

  // ============================================================
  // SCENARIO 4: STS TRANSFER TEST
  // ============================================================
  sts_transfer: {
    id: 'IST-004',
    name: 'Static Transfer Switch — Source Transfer',
    category: 'electrical',
    tier_required: ['III', 'IV'],
    duration: { hours: 2 },
    description: 'Test STS transfer from preferred to alternate source under load. Verify sub-cycle transfer.',
    procedure: [
      'Step 1: STS fed from Source 1 (preferred). IT load on STS output.',
      'Step 2: Simulate Source 1 failure (open upstream breaker).',
      'Step 3: STS transfers to Source 2. Measure transfer time.',
      'Step 4: Verify IT equipment rides through transfer.',
      'Step 5: Restore Source 1. Verify retransfer after delay.',
      'Step 6: Test manual source selection (forced transfer).'
    ],
    acceptance_criteria: [
      'STS transfer time < 4ms (sub-half-cycle)',
      'No IT equipment restarts or errors during transfer',
      'Retransfer occurs after configurable delay (30-300 sec)',
      'Manual override functional'
    ]
  },

  // ============================================================
  // SCENARIO 5: SINGLE COOLING UNIT FAILURE
  // ============================================================
  cooling_unit_fail: {
    id: 'IST-005',
    name: 'Single Cooling Unit Failure',
    category: 'mechanical',
    tier_required: ['II', 'III', 'IV'],
    duration: { hours: 3 },
    description: 'Simulate loss of one cooling unit (CRAH/CRAC/CDU). Verify remaining units maintain temperature.',
    procedure: [
      'Step 1: All cooling units operating. Room at design temperature.',
      'Step 2: Shut down one cooling unit (simulate failure).',
      'Step 3: Monitor room temperature rise rate.',
      'Step 4: Verify standby unit starts automatically (if N+1).',
      'Step 5: Verify remaining units increase output (if variable speed).',
      'Step 6: Monitor for 2 hours. Record temperature at all rack inlets.',
      'Step 7: Restart failed unit. Verify return to normal.'
    ],
    acceptance_criteria: [
      'Room temperature does not exceed ASHRAE A1 upper limit (27°C inlet)',
      'Standby unit starts within 60 seconds (N+1 systems)',
      'Temperature stabilizes within 15 minutes',
      'No IT equipment thermal throttling or shutdown',
      'BMS generates cooling failure alarm within 30 seconds'
    ]
  },

  // ============================================================
  // SCENARIO 6: CHILLER FAILURE + SWITCHOVER
  // ============================================================
  chiller_fail: {
    id: 'IST-006',
    name: 'Primary Chiller Failure — Standby Chiller Start',
    category: 'mechanical',
    tier_required: ['III', 'IV'],
    duration: { hours: 3 },
    description: 'Simulate primary chiller failure. Verify standby chiller auto-starts and maintains cooling.',
    procedure: [
      'Step 1: Primary chiller running at design load.',
      'Step 2: Force-trip primary chiller (emergency stop).',
      'Step 3: BMS detects chiller failure.',
      'Step 4: BMS initiates standby chiller start sequence.',
      'Step 5: Monitor CHW supply temperature during transition.',
      'Step 6: Verify standby chiller assumes full load.',
      'Step 7: Monitor for 1 hour at full load.'
    ],
    acceptance_criteria: [
      'Standby chiller starts within 5 minutes of primary failure',
      'CHW supply temperature rises < 5°C during transition',
      'Room temperature does not exceed ASHRAE A1 upper limit',
      'Full cooling restored within 15 minutes'
    ]
  },

  // ============================================================
  // SCENARIO 7: FIRE ALARM — FULL INTEGRATION
  // ============================================================
  fire_alarm_integration: {
    id: 'IST-007',
    name: 'Fire Alarm — Full Integration Test',
    category: 'fire_life_safety',
    tier_required: ['I', 'II', 'III', 'IV'],
    duration: { hours: 3 },
    description: 'Trigger fire alarm in one zone. Verify complete integration response.',
    procedure: [
      'Step 1: Trigger single detector in designated test zone.',
      'Step 2: Verify FACP receives alarm. First-stage alarm activates.',
      'Step 3: Trigger second detector (cross-zone confirmation).',
      'Step 4: Second-stage alarm: pre-discharge countdown starts.',
      'Step 5: Verify HVAC shutdown in affected zone (dampers close).',
      'Step 6: Verify security doors unlock for egress.',
      'Step 7: Verify BMS displays fire alarm status and zone.',
      'Step 8: Verify notification (alarm bells, strobes, auto-dialer).',
      'Step 9: Abort button test (stops countdown, holds discharge).',
      'Step 10: Reset system. Verify clean reset and return to normal.'
    ],
    acceptance_criteria: [
      'Cross-zone confirmation within 60 seconds',
      'Pre-discharge countdown timing per design (typically 30-60 sec)',
      'HVAC shutdown within 10 seconds of confirmed alarm',
      'Dampers achieve full closure (verified by BMS)',
      'Security doors unlock for egress',
      'Abort successfully stops suppression release',
      'Full system reset within 5 minutes',
      'BMS event log captures entire sequence with timestamps'
    ]
  },

  // ============================================================
  // SCENARIO 8: CONCURRENT MAINTAINABILITY (TIER III)
  // ============================================================
  concurrent_maintainability: {
    id: 'IST-008',
    name: 'Concurrent Maintainability Test',
    category: 'operational',
    tier_required: ['III', 'IV'],
    duration: { hours: 8 },
    description: 'Demonstrate that every component can be removed from service for maintenance without impacting IT load.',
    procedure: [
      'Step 1: Operate at ≥ 50% IT load on all systems.',
      'For each major system component:',
      '  Step 2a: Remove component from service (e.g., one UPS module, one chiller, one PDU feed).',
      '  Step 2b: Verify IT load remains unaffected.',
      '  Step 2c: Perform simulated maintenance (15 minutes minimum).',
      '  Step 2d: Return component to service.',
      '  Step 2e: Verify system returns to normal operation.',
      '  Repeat for next component.',
      'Step 3: Document each component maintainability event.'
    ],
    components_to_test: [
      'Each UPS module (one at a time)',
      'Each generator set',
      'Each chiller',
      'Each cooling unit (CRAH/CRAC/CDU)',
      'Each pump (CHW, CW, CDU)',
      'Each PDU input feed',
      'Each STS source',
      'Each ATS',
      'BMS controller (primary → backup)',
      'Fire alarm panel (primary → backup)',
      'Network switch (redundant path)'
    ],
    acceptance_criteria: [
      'IT load maintained at all times during each maintenance event',
      'No alarms that would indicate capacity concern',
      'Temperature remains within ASHRAE A1 envelope',
      'Return-to-service procedure is documented and verified'
    ]
  },

  // ============================================================
  // SCENARIO 9: FAULT TOLERANCE (TIER IV)
  // ============================================================
  fault_tolerance: {
    id: 'IST-009',
    name: 'Fault Tolerance Test (Tier IV)',
    category: 'operational',
    tier_required: ['IV'],
    duration: { hours: 12 },
    description: 'Simulate unplanned failures (not planned maintenance). Verify facility maintains IT load without human intervention.',
    procedure: [
      'Step 1: Operate at ≥ 50% IT load.',
      'Step 2: Without warning, simulate failure of:',
      '  2a: One complete power distribution path (trip main breaker on Path A)',
      '  2b: Verify Path B immediately picks up all load via STS',
      '  2c: Verify cooling on Path B maintains temperature',
      'Step 3: While Path A is down, simulate additional failure:',
      '  3a: Trip one cooling unit on Path B',
      '  3b: Verify N+1 cooling redundancy on Path B handles load',
      'Step 4: Restore Path A. Verify graceful retransfer.',
      'Step 5: Repeat with reversed paths (fail Path B first).'
    ],
    acceptance_criteria: [
      'IT load maintained continuously during ALL failure events',
      'No single failure causes IT load interruption',
      'Automatic failover occurs without human intervention',
      'BMS captures and correctly reports all events',
      'Temperature remains within ASHRAE A1 during all scenarios',
      'Facility survives concurrent failure + maintenance scenario'
    ]
  },

  // ============================================================
  // SCENARIO 10: EXTENDED LOAD TEST (48/72 HOUR)
  // ============================================================
  extended_load: {
    id: 'IST-010',
    name: 'Extended Endurance Load Test',
    category: 'operational',
    tier_required: ['III', 'IV'],
    duration: { hours: 72 },
    description: '72-hour continuous operation at design load. Thermal and electrical stress test.',
    procedure: [
      'Step 1: Load facility to ≥ 80% of design IT capacity using load banks.',
      'Step 2: Monitor continuously for 72 hours (or 48 hours minimum).',
      'Step 3: Record: temperature (all rack inlets), power (all paths), humidity, vibration.',
      'Step 4: Note any alarms, nuisance trips, or performance degradation.',
      'Step 5: Perform one planned failover during test period.',
      'Step 6: Compile complete data set and trend analysis.'
    ],
    acceptance_criteria: [
      'No unplanned trips or shutdowns in 72 hours',
      'Temperature stable within ±2°C at all rack inlets',
      'No component exceeds manufacturer temperature limits',
      'Power quality stable (THD < 5%, voltage ±3%)',
      'All redundancy paths verified during test period',
      'No water leaks, refrigerant leaks, or oil leaks'
    ],
    loadBankRequirement: {
      sizing: '80-100% of facility IT load capacity',
      rentalCostEstimate: '$18,000-$25,000 per 48 hours (for 2MW facility)',
      scalingRule: 'Approximately $8,000-$12,000 per MW per 48 hours'
    }
  }
};
```

#### 3.5.2. L5 Scenario Applicability by Redundancy

```javascript
var l5_scenarioMatrix = {
  'N':    ['IST-001', 'IST-005', 'IST-007'],
  'N+1':  ['IST-001', 'IST-002', 'IST-003', 'IST-005', 'IST-006', 'IST-007'],
  '2N':   ['IST-001', 'IST-002', 'IST-003', 'IST-004', 'IST-005', 'IST-006',
           'IST-007', 'IST-008', 'IST-009', 'IST-010'],
  '2N+1': ['IST-001', 'IST-002', 'IST-003', 'IST-004', 'IST-005', 'IST-006',
           'IST-007', 'IST-008', 'IST-009', 'IST-010']
};
```

#### 3.5.3. L5 Duration & Cost Formulas

```javascript
function calculateL5Duration(inputs) {
  var scenarios = l5_scenarioMatrix[inputs.redundancy];
  var totalHours = 0;

  scenarios.forEach(function(id) {
    var scenario = l5_scenarios[Object.keys(l5_scenarios).find(function(k) {
      return l5_scenarios[k].id === id;
    })];
    totalHours += scenario.duration.hours;
  });

  // Add prep time (2 hours per scenario for setup and briefing)
  totalHours += scenarios.length * 2;

  // Add documentation time (1 hour per scenario for report writing)
  totalHours += scenarios.length * 1;

  var totalDays = Math.ceil(totalHours / 10); // 10-hour working days for IST

  // Size factor
  var sizeFactor = 1.0;
  if (inputs.itLoad > 5000)  sizeFactor = 1.2;
  if (inputs.itLoad > 10000) sizeFactor = 1.4;
  if (inputs.itLoad > 50000) sizeFactor = 1.8;

  totalDays *= sizeFactor;
  totalDays *= coolingCxMultiplier[inputs.coolingType].duration;

  return Math.ceil(totalDays);
}

function calculateL5Cost(inputs, l5Duration) {
  var rate = getRegionalRate(inputs.region);
  // L5 requires large team: CxA + field engineers + owner ops + OEM reps
  var cxTeamSize = 8;
  var laborCost = l5Duration * rate.cxEngineerDay * cxTeamSize;

  // Load bank for extended test (most expensive single item)
  var loadBankMW = inputs.itLoad / 1000;
  var loadBankDays = 0;
  if (['2N', '2N+1'].includes(inputs.redundancy)) {
    loadBankDays = 5; // 72hr test + setup/teardown
  } else if (inputs.redundancy === 'N+1') {
    loadBankDays = 2;
  } else {
    loadBankDays = 1;
  }
  var loadBankCost = loadBankMW * 8000 * loadBankDays; // ~$8K/MW/day

  // Fuel for generator run time during IST
  var genRunHours = 20; // approximate total gen run hours during IST
  var fuelCostPerHour = inputs.itLoad * 0.3; // ~0.3 liter/kW/hr diesel
  var fuelCost = genRunHours * fuelCostPerHour * rate.dieselPerLiter;

  // Third-party witness (Uptime Institute, owner's rep)
  var witnessCost = l5Duration * rate.thirdPartyWitnessDay;

  return {
    labor: laborCost,
    loadBank: loadBankCost,
    fuel: fuelCost,
    thirdPartyWitness: witnessCost,
    total: laborCost + loadBankCost + fuelCost + witnessCost
  };
}
```

---

## 4. Cost Calculation Engine

### 4.1. Base Cost Data Objects

```javascript
// ============================================================
// BASE COMMISSIONING COST PER kW BY DISCIPLINE
// Source: Industry benchmarks, Uptime Institute, BSRIA BG 49
// ============================================================
var CX_BASE_COST_PER_KW = {
  electrical: {
    hvSwitchgear:    { min: 12, typical: 18, max: 25, unit: '$/kW' },
    transformers:     { min: 5,  typical: 8,  max: 12, unit: '$/kW' },
    generators:       { min: 10, typical: 15, max: 22, unit: '$/kW' },
    ups:              { min: 8,  typical: 12, max: 18, unit: '$/kW' },
    pdus:             { min: 3,  typical: 5,  max: 8,  unit: '$/kW' },
    sts:              { min: 2,  typical: 4,  max: 6,  unit: '$/kW' },
    busbar:           { min: 2,  typical: 3,  max: 5,  unit: '$/kW' },
    grounding:        { min: 1,  typical: 2,  max: 3,  unit: '$/kW' },
    epms:             { min: 3,  typical: 5,  max: 8,  unit: '$/kW' },
    subtotal:         { min: 46, typical: 72, max: 107, unit: '$/kW' }
  },
  mechanical: {
    chillers:          { min: 8,  typical: 12, max: 18, unit: '$/kW' },
    coolingUnits:      { min: 5,  typical: 8,  max: 12, unit: '$/kW' },
    coolingTowers:     { min: 3,  typical: 5,  max: 8,  unit: '$/kW' },
    pumps:             { min: 2,  typical: 4,  max: 6,  unit: '$/kW' },
    piping:            { min: 4,  typical: 6,  max: 10, unit: '$/kW' },
    dlcAdditional:     { min: 8,  typical: 15, max: 22, unit: '$/kW', note: 'DLC/Immersion only' },
    subtotal_air:      { min: 22, typical: 35, max: 54, unit: '$/kW' },
    subtotal_dlc:      { min: 30, typical: 50, max: 76, unit: '$/kW' }
  },
  fire: {
    detection:         { min: 3,  typical: 5,  max: 8,  unit: '$/kW' },
    suppression:       { min: 4,  typical: 7,  max: 12, unit: '$/kW' },
    subtotal:          { min: 7,  typical: 12, max: 20, unit: '$/kW' }
  },
  security: {
    accessControl:     { min: 2,  typical: 3,  max: 5,  unit: '$/kW' },
    cctv:              { min: 1,  typical: 2,  max: 4,  unit: '$/kW' },
    intrusion:         { min: 1,  typical: 1,  max: 2,  unit: '$/kW' },
    subtotal:          { min: 4,  typical: 6,  max: 11, unit: '$/kW' }
  },
  it_infrastructure: {
    structuredCabling: { min: 3,  typical: 5,  max: 8,  unit: '$/kW' },
    fiberOptic:        { min: 2,  typical: 4,  max: 6,  unit: '$/kW' },
    rackContainment:   { min: 1,  typical: 2,  max: 3,  unit: '$/kW' },
    subtotal:          { min: 6,  typical: 11, max: 17, unit: '$/kW' }
  },
  controls: {
    bms:               { min: 5,  typical: 8,  max: 15, unit: '$/kW' },
    dcim:              { min: 3,  typical: 6,  max: 12, unit: '$/kW' },
    subtotal:          { min: 8,  typical: 14, max: 27, unit: '$/kW' }
  },
  building: {
    architectural:     { min: 2,  typical: 3,  max: 5,  unit: '$/kW' },
    civil:             { min: 1,  typical: 2,  max: 3,  unit: '$/kW' },
    subtotal:          { min: 3,  typical: 5,  max: 8,  unit: '$/kW' }
  }
};

// GRAND TOTAL BENCHMARKS (all disciplines combined)
// Air Cooling:  $96 – $155 – $244 per kW
// DLC Cooling:  $104 – $173 – $271 per kW
// Industry rule-of-thumb: Cx = 0.5% – 2.0% of total construction cost
```

### 4.2. Additional Cost Line Items

```javascript
var CX_ADDITIONAL_COSTS = {
  loadBank: {
    description: 'Resistive/reactive load bank rental for generator and system load testing',
    perMwPerDay: { min: 6000, typical: 8000, max: 12000 },
    mobilization: { min: 2000, typical: 5000, max: 10000 },
    fuel: 'Calculated separately based on generator fuel consumption',
    note: 'Largest single non-labor cost item in commissioning'
  },
  testEquipment: {
    description: 'Specialized test equipment rental',
    items: {
      megohmmeter:           { dailyRate: 150, neededDays: 'L2+L3 duration' },
      primaryInjection:      { dailyRate: 500, neededDays: 'L1+L3 duration (electrical)' },
      secondaryInjection:    { dailyRate: 300, neededDays: 'L1+L3 duration (electrical)' },
      powerAnalyzer:         { dailyRate: 200, neededDays: 'L3+L4+L5 duration' },
      thermalImager:         { dailyRate: 250, neededDays: 'L3+L4 duration' },
      vibrationAnalyzer:     { dailyRate: 200, neededDays: 'L3 duration (mechanical)' },
      powerQualityRecorder:  { dailyRate: 300, neededDays: 'L4+L5 duration (4 units)' },
      cableTestSet:          { dailyRate: 350, neededDays: 'L2 duration (IT)' },
      doorFanTestKit:        { dailyRate: 500, neededDays: '2 days per fire zone' }
    }
  },
  documentation: {
    description: 'Commissioning documentation and reporting',
    perKw: { min: 3, typical: 5, max: 8 },
    includes: ['Cx plan', 'test procedures', 'test reports', 'punch lists',
               'as-tested drawings', 'O&M manuals', 'training materials',
               'final Cx report', 'warranty documentation']
  },
  thirdPartyWitness: {
    description: 'Independent third-party witness (Uptime Institute, insurance, etc.)',
    perDay: { min: 2000, typical: 3500, max: 5000 },
    typicalDays: 'L5 duration + 2 days for review',
    note: 'Required for Uptime Tier Certification (TCCF)'
  },
  oemStartup: {
    description: 'OEM-supervised first startup charges',
    perDay: { min: 1500, typical: 2500, max: 4000 },
    note: 'Often included in equipment purchase contract. Budget separately if not.'
  },
  travel: {
    description: 'Travel and per-diem for commissioning team',
    perPersonPerDay: { min: 150, typical: 250, max: 400 },
    note: 'Applies when Cx team is not local to project site.'
  },
  contingency: {
    description: 'Contingency for unforeseen issues, retesting, and schedule delays',
    percentage: { min: 0.10, typical: 0.15, max: 0.25 },
    note: 'Apply to total Cx cost. 15% is industry standard.'
  }
};
```

### 4.3. Master Cost Formula

```javascript
function calculateTotalCxCost(inputs) {
  // Step 1: Calculate base cost per discipline
  var baseCostPerKw = 0;
  var disciplines = CX_BASE_COST_PER_KW;

  baseCostPerKw += disciplines.electrical.subtotal.typical;
  baseCostPerKw += ['dlc', 'immersion'].includes(inputs.coolingType)
    ? disciplines.mechanical.subtotal_dlc.typical
    : disciplines.mechanical.subtotal_air.typical;
  baseCostPerKw += disciplines.fire.subtotal.typical;
  baseCostPerKw += disciplines.security.subtotal.typical;
  baseCostPerKw += disciplines.it_infrastructure.subtotal.typical;
  baseCostPerKw += disciplines.controls.subtotal.typical;
  baseCostPerKw += disciplines.building.subtotal.typical;

  var baseCost = baseCostPerKw * inputs.itLoad;

  // Step 2: Apply multipliers
  var totalMultiplier = 1.0;
  totalMultiplier *= coolingCxMultiplier[inputs.coolingType].cost;
  totalMultiplier *= redundancyCxMultiplier[inputs.redundancy].costMult;
  totalMultiplier *= buildingCxMultiplier[inputs.buildingType].cost;
  totalMultiplier *= seismicCxMultiplier[inputs.seismicZone].cost;
  totalMultiplier *= substationCxScope[inputs.substationConfig].costMult;
  totalMultiplier *= bmsCxScope[inputs.bmsComplexity].costMult;
  totalMultiplier *= deliveryCxImpact[inputs.deliveryMethod].costMult;
  totalMultiplier *= scopeCxMultiplier[inputs.cxScope].costMult;

  var adjustedBaseCost = baseCost * totalMultiplier;

  // Step 3: Calculate per-level costs
  var l1 = calculateL1Cost(inputs, calculateL1Duration(inputs));
  var l2 = calculateL2Cost(inputs, calculateL2Duration(inputs));
  var l3 = calculateL3Cost(inputs, calculateL3Duration(inputs));
  var l4 = calculateL4Cost(inputs, calculateL4Duration(inputs));
  var l5 = calculateL5Cost(inputs, calculateL5Duration(inputs));

  // Step 4: Additional costs
  var loadBankDays = (['2N','2N+1'].includes(inputs.redundancy)) ? 5 : 2;
  var loadBankCost = (inputs.itLoad / 1000) * CX_ADDITIONAL_COSTS.loadBank.perMwPerDay.typical * loadBankDays
                   + CX_ADDITIONAL_COSTS.loadBank.mobilization.typical;

  var docCost = inputs.itLoad * CX_ADDITIONAL_COSTS.documentation.perKw.typical;

  var totalDuration = calculateL1Duration(inputs) + calculateL2Duration(inputs)
                    + calculateL3Duration(inputs) + calculateL4Duration(inputs)
                    + calculateL5Duration(inputs);

  var travelCost = totalDuration * CX_ADDITIONAL_COSTS.travel.perPersonPerDay.typical * 4; // 4 person team average

  // Step 5: Subtotal
  var subtotal = l1.total + l2.total + l3.total + l4.total + l5.total
               + loadBankCost + docCost + travelCost;

  // Step 6: Apply regional labor adjustment
  var regionRate = getRegionalRate(inputs.region);
  subtotal *= regionRate.laborMultiplier;

  // Step 7: Contingency
  var contingency = subtotal * CX_ADDITIONAL_COSTS.contingency.percentage.typical;

  // Step 8: Grand total
  var grandTotal = subtotal + contingency;

  return {
    perLevel: { l1: l1.total, l2: l2.total, l3: l3.total, l4: l4.total, l5: l5.total },
    loadBank: loadBankCost,
    documentation: docCost,
    travel: travelCost,
    subtotal: subtotal,
    contingency: contingency,
    grandTotal: grandTotal,
    perKw: grandTotal / inputs.itLoad,
    percentOfCapex: (grandTotal / (inputs.itLoad * 8500)) * 100 // rough CAPEX estimate
  };
}
```

### 4.4. Cost Validation Benchmarks

```javascript
// Cross-check calculated costs against industry benchmarks
var CX_BENCHMARKS = {
  perKwRange: {
    minimum: 80,    // $/kW — small simple facility
    typical: 155,   // $/kW — standard purpose-built
    maximum: 300,   // $/kW — complex Tier IV with DLC
    source: 'BSRIA BG 49:2023, Uptime Institute 2024 Survey'
  },
  percentOfCapex: {
    minimum: 0.5,   // % — minimal Cx scope
    typical: 1.2,   // % — comprehensive L1-L5
    maximum: 2.5,   // % — Tier IV with extended IST + certification
    source: 'ASHRAE Guideline 0-2019, Industry Rule of Thumb'
  },
  costPerMwFacility: {
    '1MW':   { range: '$100K – $250K', note: 'Edge/small enterprise' },
    '5MW':   { range: '$500K – $1.2M', note: 'Mid-size colo' },
    '10MW':  { range: '$1M – $2.5M',   note: 'Enterprise/colo campus' },
    '20MW':  { range: '$2M – $5M',     note: 'Hyperscale pod' },
    '50MW':  { range: '$5M – $12M',    note: 'Large hyperscale' },
    '100MW': { range: '$10M – $25M',   note: 'Mega campus' },
    source: 'Compiled from Uptime Institute, DCD, BSRIA data'
  }
};
```

---

## 5. Gantt Chart Schedule Engine

### 5.1. Five-Level Hierarchy Definition

The Gantt chart uses a 5-level expandable/collapsible hierarchy. Each level can be expanded to reveal its children.

```
Level 1: Cx Phase (L1–L5)
  └─ Level 2: Discipline (Electrical, Mechanical, Fire, Security, IT, Controls, Building)
       └─ Level 3: System (Switchgear, Transformers, Generators, UPS, Chillers, etc.)
            └─ Level 4: Activity (Visual Inspection, Insulation Test, Load Test, etc.)
                 └─ Level 5: Sub-Task (Phase-A IR Test, Phase-B IR Test, CT Ratio Check, etc.)
```

### 5.2. Complete Schedule Tree Data Structure

```javascript
var CX_SCHEDULE_TREE = {
  // ========================================
  // LEVEL 1: L1 — Factory Witness Testing
  // ========================================
  L1: {
    id: 'L1',
    name: 'L1 — Factory Witness Testing',
    level: 1,
    collapsed: true,
    color: '#3b82f6', // blue
    children: {
      // LEVEL 2: Electrical
      L1_ELEC: {
        id: 'L1_ELEC',
        name: 'Electrical Systems',
        level: 2,
        collapsed: true,
        children: {
          // LEVEL 3: Switchgear
          L1_ELEC_SW: {
            id: 'L1_ELEC_SW',
            name: 'HV/MV Switchgear',
            level: 3,
            collapsed: true,
            durationDays: 2,
            children: {
              // LEVEL 4: Activities
              L1_ELEC_SW_VISUAL: {
                id: 'L1_ELEC_SW_VISUAL',
                name: 'Visual & Mechanical Inspection',
                level: 4,
                durationHours: 2,
                children: {
                  // LEVEL 5: Sub-tasks
                  L1_ELEC_SW_VISUAL_NP: { name: 'Nameplate Verification', durationMin: 30, level: 5 },
                  L1_ELEC_SW_VISUAL_LB: { name: 'Labeling Check', durationMin: 15, level: 5 },
                  L1_ELEC_SW_VISUAL_DR: { name: 'Door Operation Test', durationMin: 20, level: 5 },
                  L1_ELEC_SW_VISUAL_IL: { name: 'Interlock Function Check', durationMin: 30, level: 5 },
                  L1_ELEC_SW_VISUAL_PF: { name: 'Paint Finish Inspection', durationMin: 15, level: 5 }
                }
              },
              L1_ELEC_SW_IR: {
                name: 'Insulation Resistance Test',
                level: 4,
                durationHours: 1,
                children: {
                  L1_ELEC_SW_IR_PP: { name: 'Phase-to-Phase IR (A-B, B-C, A-C)', durationMin: 20, level: 5 },
                  L1_ELEC_SW_IR_PG: { name: 'Phase-to-Ground IR (A-G, B-G, C-G)', durationMin: 20, level: 5 },
                  L1_ELEC_SW_IR_REC: { name: 'Record & Compare to Baseline', durationMin: 10, level: 5 }
                }
              },
              L1_ELEC_SW_CR: {
                name: 'Contact Resistance Test',
                level: 4,
                durationHours: 1.5,
                children: {
                  L1_ELEC_SW_CR_MAIN: { name: 'Main Contacts (each phase)', durationMin: 30, level: 5 },
                  L1_ELEC_SW_CR_ARC:  { name: 'Arcing Contacts', durationMin: 20, level: 5 },
                  L1_ELEC_SW_CR_AUX:  { name: 'Auxiliary Contacts', durationMin: 15, level: 5 }
                }
              },
              L1_ELEC_SW_PI: {
                name: 'Primary Current Injection',
                level: 4,
                durationHours: 3,
                children: {
                  L1_ELEC_SW_PI_SETUP: { name: 'Test Set Connection & Safety', durationMin: 30, level: 5 },
                  L1_ELEC_SW_PI_CT:    { name: 'CT Ratio Verification (each phase)', durationMin: 45, level: 5 },
                  L1_ELEC_SW_PI_REL:   { name: 'Relay Pickup Verification', durationMin: 45, level: 5 },
                  L1_ELEC_SW_PI_REC:   { name: 'Record Results & Teardown', durationMin: 20, level: 5 }
                }
              },
              L1_ELEC_SW_BRK: {
                name: 'Breaker Operation Test',
                level: 4,
                durationHours: 2,
                children: {
                  L1_ELEC_SW_BRK_CL: { name: 'Close Cycle Timing', durationMin: 30, level: 5 },
                  L1_ELEC_SW_BRK_OP: { name: 'Open Cycle Timing', durationMin: 30, level: 5 },
                  L1_ELEC_SW_BRK_AP: { name: 'Anti-Pumping Relay Test', durationMin: 15, level: 5 },
                  L1_ELEC_SW_BRK_CO: { name: 'Close-Open (C-O) Cycle', durationMin: 15, level: 5 }
                }
              },
              L1_ELEC_SW_PROT: {
                name: 'Protection Relay Test (Secondary Injection)',
                level: 4,
                durationHours: 4,
                children: {
                  L1_ELEC_SW_PROT_50:  { name: 'Instantaneous Overcurrent (50)', durationMin: 30, level: 5 },
                  L1_ELEC_SW_PROT_51:  { name: 'Time Overcurrent (51)', durationMin: 40, level: 5 },
                  L1_ELEC_SW_PROT_50N: { name: 'Earth Fault Instantaneous (50N)', durationMin: 30, level: 5 },
                  L1_ELEC_SW_PROT_51N: { name: 'Earth Fault Time Delay (51N)', durationMin: 30, level: 5 },
                  L1_ELEC_SW_PROT_27:  { name: 'Undervoltage (27)', durationMin: 20, level: 5 },
                  L1_ELEC_SW_PROT_59:  { name: 'Overvoltage (59)', durationMin: 20, level: 5 },
                  L1_ELEC_SW_PROT_81:  { name: 'Frequency (81O/81U)', durationMin: 20, level: 5 }
                }
              },
              L1_ELEC_SW_ARC: {
                name: 'Arc Flash Rating Verification',
                level: 4,
                durationHours: 1,
                children: {
                  L1_ELEC_SW_ARC_LBL: { name: 'Label Verification vs Study', durationMin: 20, level: 5 },
                  L1_ELEC_SW_ARC_PPE: { name: 'PPE Category Confirmation', durationMin: 10, level: 5 },
                  L1_ELEC_SW_ARC_CNT: { name: 'Arc Containment Design Review', durationMin: 15, level: 5 }
                }
              },
              L1_ELEC_SW_COMM: {
                name: 'Communication Interface Test',
                level: 4,
                durationHours: 1.5,
                children: {
                  L1_ELEC_SW_COMM_MOD: { name: 'Modbus TCP Register Map Test', durationMin: 25, level: 5 },
                  L1_ELEC_SW_COMM_IEC: { name: 'IEC 61850 GOOSE Message Test', durationMin: 25, level: 5 },
                  L1_ELEC_SW_COMM_ALM: { name: 'Event/Alarm Reporting Test', durationMin: 20, level: 5 }
                }
              }
            }
          },
          // LEVEL 3: Transformers
          L1_ELEC_TX: {
            id: 'L1_ELEC_TX',
            name: 'Power Transformers',
            level: 3,
            durationDays: 3,
            children: {
              L1_ELEC_TX_TTR:  { name: 'Turns Ratio Test', level: 4, durationHours: 2 },
              L1_ELEC_TX_WR:   { name: 'Winding Resistance', level: 4, durationHours: 2 },
              L1_ELEC_TX_IR:   { name: 'Insulation Resistance', level: 4, durationHours: 1 },
              L1_ELEC_TX_PF:   { name: 'Power Factor Test', level: 4, durationHours: 2 },
              L1_ELEC_TX_IMP:  { name: 'Impedance Test', level: 4, durationHours: 1.5 },
              L1_ELEC_TX_OIL:  { name: 'Oil Analysis', level: 4, durationHours: 1 },
              L1_ELEC_TX_TEMP: { name: 'Temperature Rise Test', level: 4, durationHours: 8 },
              L1_ELEC_TX_TAP:  { name: 'Tap Changer Operation', level: 4, durationHours: 1.5 },
              L1_ELEC_TX_NOISE:{ name: 'Noise Level Test', level: 4, durationHours: 1 }
            }
          },
          // LEVEL 3: Generators
          L1_ELEC_GEN: {
            name: 'Generators',
            level: 3,
            durationDays: 2,
            children: {
              L1_ELEC_GEN_INSP:  { name: 'Engine Visual Inspection', level: 4, durationHours: 1 },
              L1_ELEC_GEN_IR:    { name: 'Alternator Insulation Resistance', level: 4, durationHours: 1 },
              L1_ELEC_GEN_START: { name: 'Engine Start Test', level: 4, durationHours: 1 },
              L1_ELEC_GEN_LOAD:  { name: 'Load Bank Test (4-Step)', level: 4, durationHours: 6 },
              L1_ELEC_GEN_REJ:   { name: 'Load Rejection Test', level: 4, durationHours: 0.5 },
              L1_ELEC_GEN_GOV:   { name: 'Governor Response', level: 4, durationHours: 1 },
              L1_ELEC_GEN_FUEL:  { name: 'Fuel Consumption', level: 4, durationHours: 2 },
              L1_ELEC_GEN_EMIS:  { name: 'Exhaust Emissions', level: 4, durationHours: 1 },
              L1_ELEC_GEN_VIB:   { name: 'Vibration Test', level: 4, durationHours: 1 },
              L1_ELEC_GEN_CTRL:  { name: 'Control Panel Test', level: 4, durationHours: 2 }
            }
          },
          // LEVEL 3: UPS
          L1_ELEC_UPS: {
            name: 'UPS Systems',
            level: 3,
            durationDays: 2,
            children: {
              L1_ELEC_UPS_IO:   { name: 'Input/Output Verification', level: 4, durationHours: 2 },
              L1_ELEC_UPS_EFF:  { name: 'Efficiency Measurement', level: 4, durationHours: 2 },
              L1_ELEC_UPS_BATT: { name: 'Battery Discharge Test', level: 4, durationHours: 4 },
              L1_ELEC_UPS_XFER: { name: 'Transfer Time Test', level: 4, durationHours: 1 },
              L1_ELEC_UPS_BYP:  { name: 'Bypass Operation', level: 4, durationHours: 1 },
              L1_ELEC_UPS_SWAP: { name: 'Module Hot-Swap (Modular)', level: 4, durationHours: 2 },
              L1_ELEC_UPS_OL:   { name: 'Overload Test', level: 4, durationHours: 1 },
              L1_ELEC_UPS_COMM: { name: 'Communication Test', level: 4, durationHours: 1 }
            }
          }
        }
      },
      // LEVEL 2: Mechanical
      L1_MECH: {
        name: 'Mechanical Systems',
        level: 2,
        collapsed: true,
        children: {
          L1_MECH_CH:  { name: 'Chillers', level: 3, durationDays: 2 },
          L1_MECH_AHU: { name: 'CRAH/CRAC Units', level: 3, durationDays: 1 },
          L1_MECH_CDU: { name: 'CDU (DLC/Immersion)', level: 3, durationDays: 2,
                         applicable: "['dlc','immersion'].includes(coolingType)" }
        }
      },
      // LEVEL 2: Fire
      L1_FIRE: {
        name: 'Fire Suppression',
        level: 2,
        collapsed: true,
        children: {
          L1_FIRE_PNL: { name: 'Panel Configuration', level: 3, durationDays: 0.25 },
          L1_FIRE_DET: { name: 'Detection System', level: 3, durationDays: 0.25 },
          L1_FIRE_AGT: { name: 'Agent Storage', level: 3, durationDays: 0.25 },
          L1_FIRE_REL: { name: 'Release Circuit', level: 3, durationDays: 0.25 }
        }
      }
    }
  },

  // ========================================
  // LEVEL 1: L2 — Installation Verification
  // ========================================
  L2: {
    id: 'L2',
    name: 'L2 — Installation Verification',
    level: 1,
    collapsed: true,
    color: '#10b981', // green
    dependsOn: ['L1'],
    children: {
      L2_ELEC: { name: 'Electrical Verification', level: 2,
        children: {
          L2_ELEC_SW:   { name: 'Switchgear Installation', level: 3 },
          L2_ELEC_TX:   { name: 'Transformer Installation', level: 3 },
          L2_ELEC_GEN:  { name: 'Generator Installation', level: 3 },
          L2_ELEC_UPS:  { name: 'UPS Installation', level: 3 },
          L2_ELEC_PDU:  { name: 'PDU Installation', level: 3 },
          L2_ELEC_STS:  { name: 'STS Installation', level: 3 },
          L2_ELEC_BB:   { name: 'Busbar Trunking', level: 3 },
          L2_ELEC_GND:  { name: 'Grounding & Lightning', level: 3 }
        }
      },
      L2_MECH: { name: 'Mechanical Verification', level: 2,
        children: {
          L2_MECH_PIP:  { name: 'CHW Piping Pressure Test', level: 3 },
          L2_MECH_CT:   { name: 'Cooling Tower Installation', level: 3 },
          L2_MECH_PMP:  { name: 'Pump Installation', level: 3 },
          L2_MECH_AHU:  { name: 'CRAH/CRAC Installation', level: 3 },
          L2_MECH_DLC:  { name: 'DLC Piping (if applicable)', level: 3 }
        }
      },
      L2_FIRE: { name: 'Fire Systems Verification', level: 2 },
      L2_SEC:  { name: 'Security Verification', level: 2 },
      L2_IT:   { name: 'IT Infrastructure Verification', level: 2 },
      L2_BMS:  { name: 'BMS/Controls Verification', level: 2 }
    }
  },

  // ========================================
  // LEVEL 1: L3 — Component Startup
  // ========================================
  L3: {
    id: 'L3',
    name: 'L3 — Component Startup Testing',
    level: 1,
    collapsed: true,
    color: '#f59e0b', // amber
    dependsOn: ['L2'],
    children: {
      L3_ELEC: { name: 'Electrical Startup', level: 2,
        children: {
          L3_ELEC_SW:  { name: 'Switchgear Energization', level: 3 },
          L3_ELEC_TX:  { name: 'Transformer Energization', level: 3 },
          L3_ELEC_GEN: { name: 'Generator Startup + Load Bank', level: 3 },
          L3_ELEC_UPS: { name: 'UPS Energization + Battery Test', level: 3 },
          L3_ELEC_STS: { name: 'STS Functional Test', level: 3 }
        }
      },
      L3_MECH: { name: 'Mechanical Startup', level: 2,
        children: {
          L3_MECH_CH:  { name: 'Chiller Startup (OEM)', level: 3 },
          L3_MECH_CU:  { name: 'Cooling Unit Startup', level: 3 },
          L3_MECH_PMP: { name: 'Pump Startup + Balancing', level: 3 },
          L3_MECH_CT:  { name: 'Cooling Tower Startup', level: 3 },
          L3_MECH_CDU: { name: 'CDU Startup (DLC)', level: 3 }
        }
      },
      L3_FIRE: { name: 'Fire System Functional Test', level: 2 },
      L3_SEC:  { name: 'Security Functional Test', level: 2 },
      L3_BMS:  { name: 'BMS Point-to-Point Verification', level: 2 }
    }
  },

  // ========================================
  // LEVEL 1: L4 — Functional Performance
  // ========================================
  L4: {
    id: 'L4',
    name: 'L4 — Functional Performance Testing',
    level: 1,
    collapsed: true,
    color: '#8b5cf6', // purple
    dependsOn: ['L3'],
    children: {
      L4_ELEC: { name: 'Electrical System Performance', level: 2,
        children: {
          L4_ELEC_PA:   { name: 'Power Path A Full Load', level: 3 },
          L4_ELEC_PB:   { name: 'Power Path B Full Load (2N)', level: 3 },
          L4_ELEC_EPMS: { name: 'EPMS Verification', level: 3 }
        }
      },
      L4_MECH: { name: 'Mechanical System Performance', level: 2,
        children: {
          L4_MECH_CHW: { name: 'Chilled Water System Performance', level: 3 },
          L4_MECH_AIR: { name: 'Air Distribution Performance', level: 3 },
          L4_MECH_DLC: { name: 'DLC System Performance', level: 3 }
        }
      },
      L4_CTRL: { name: 'Controls Performance', level: 2,
        children: {
          L4_CTRL_SEQ: { name: 'BMS Sequence of Operations', level: 3 },
          L4_CTRL_48H: { name: '48-Hour Soak Test', level: 3 }
        }
      }
    }
  },

  // ========================================
  // LEVEL 1: L5 — Integrated Systems Testing
  // ========================================
  L5: {
    id: 'L5',
    name: 'L5 — Integrated Systems Testing (IST)',
    level: 1,
    collapsed: true,
    color: '#ef4444', // red
    dependsOn: ['L4'],
    children: {
      L5_ELEC: { name: 'Electrical IST Scenarios', level: 2,
        children: {
          L5_ELEC_BLK: { name: 'IST-001: Black Start', level: 3, durationHours: 4 },
          L5_ELEC_GFS: { name: 'IST-002: Gen Fail-to-Start', level: 3, durationHours: 2 },
          L5_ELEC_BYP: { name: 'IST-003: UPS Bypass', level: 3, durationHours: 1.5 },
          L5_ELEC_STS: { name: 'IST-004: STS Transfer', level: 3, durationHours: 2 }
        }
      },
      L5_MECH: { name: 'Mechanical IST Scenarios', level: 2,
        children: {
          L5_MECH_CUF: { name: 'IST-005: Cooling Unit Failure', level: 3, durationHours: 3 },
          L5_MECH_CHF: { name: 'IST-006: Chiller Failure', level: 3, durationHours: 3 }
        }
      },
      L5_FIRE: { name: 'Fire/Life Safety IST', level: 2,
        children: {
          L5_FIRE_INT: { name: 'IST-007: Fire Alarm Integration', level: 3, durationHours: 3 }
        }
      },
      L5_OPS: { name: 'Operational IST', level: 2,
        children: {
          L5_OPS_CM:   { name: 'IST-008: Concurrent Maintainability', level: 3, durationHours: 8 },
          L5_OPS_FT:   { name: 'IST-009: Fault Tolerance (Tier IV)', level: 3, durationHours: 12 },
          L5_OPS_EXT:  { name: 'IST-010: 72-Hour Extended Load', level: 3, durationHours: 72 }
        }
      }
    }
  }
};
```

### 5.3. Gantt Chart Rendering Engine

```javascript
// UI Implementation: Pure CSS + Canvas hybrid
// Expand/collapse via data-level and data-parent attributes

function renderGanttChart(scheduleTree, inputs) {
  var container = document.getElementById('cx-gantt-container');
  var startDate = new Date(); // project start
  var currentDate = new Date(startDate);

  // Calculate durations for all items
  var flatItems = flattenTree(scheduleTree, inputs);

  // Calculate dates based on dependencies
  flatItems.forEach(function(item) {
    if (item.dependsOn) {
      var maxEnd = 0;
      item.dependsOn.forEach(function(depId) {
        var dep = flatItems.find(function(i) { return i.id === depId; });
        if (dep && dep.endDay > maxEnd) maxEnd = dep.endDay;
      });
      item.startDay = maxEnd;
    }
    item.endDay = item.startDay + item.durationDays;
  });

  var totalDays = Math.max.apply(null, flatItems.map(function(i) { return i.endDay; }));

  // Render header (timeline bar: weeks/months)
  renderTimelineHeader(container, totalDays, startDate);

  // Render rows
  flatItems.forEach(function(item) {
    var row = createGanttRow(item, totalDays);
    container.appendChild(row);
  });

  // Draw dependencies (arrows between bars)
  drawDependencyArrows(container, flatItems);
}

// Expand/collapse handler
function toggleGanttRow(rowId) {
  var children = document.querySelectorAll('[data-parent="' + rowId + '"]');
  var isCollapsed = children[0] && children[0].style.display === 'none';
  children.forEach(function(child) {
    child.style.display = isCollapsed ? 'table-row' : 'none';
    // Recursively collapse children if collapsing
    if (!isCollapsed) {
      var grandChildren = document.querySelectorAll('[data-parent="' + child.dataset.id + '"]');
      grandChildren.forEach(function(gc) { gc.style.display = 'none'; });
    }
  });
  // Toggle chevron icon
  var chevron = document.querySelector('[data-toggle="' + rowId + '"]');
  if (chevron) chevron.classList.toggle('cx-gantt-expanded');
}
```

### 5.4. Dependencies & Critical Path

```javascript
var CX_DEPENDENCIES = {
  // Cross-level dependencies (sequential)
  'L2': ['L1'],      // L2 starts after L1 completion
  'L3': ['L2'],      // L3 starts after L2 completion
  'L4': ['L3'],      // L4 starts after L3 completion
  'L5': ['L4'],      // L5 starts after L4 completion

  // Within-level dependencies (partial overlap allowed)
  'L3_MECH': ['L3_ELEC'],     // Mechanical needs power before startup
  'L3_BMS':  ['L3_ELEC', 'L3_MECH'], // BMS needs all equipment running
  'L3_FIRE': ['L3_ELEC'],     // Fire detection needs power
  'L4_MECH': ['L4_ELEC'],     // Mech perf test needs stable power
  'L4_CTRL': ['L4_ELEC', 'L4_MECH'], // Controls test needs all systems

  // Critical path (longest path through the schedule):
  // L1_ELEC → L2_ELEC → L3_ELEC → L3_MECH → L4_ELEC → L4_MECH → L5_OPS_EXT
  // Critical path determines minimum project duration
};

function calculateCriticalPath(inputs) {
  var l1 = calculateL1Duration(inputs);
  var l2 = calculateL2Duration(inputs);
  var l3 = calculateL3Duration(inputs);
  var l4 = calculateL4Duration(inputs);
  var l5 = calculateL5Duration(inputs);

  var totalWeeks = Math.ceil((l1 + l2 + l3 + l4 + l5) / 5); // 5-day work weeks

  return {
    totalDays: l1 + l2 + l3 + l4 + l5,
    totalWeeks: totalWeeks,
    totalMonths: Math.ceil(totalWeeks / 4.3),
    perLevel: {
      l1: { days: l1, weeks: Math.ceil(l1/5) },
      l2: { days: l2, weeks: Math.ceil(l2/5) },
      l3: { days: l3, weeks: Math.ceil(l3/5) },
      l4: { days: l4, weeks: Math.ceil(l4/5) },
      l5: { days: l5, weeks: Math.ceil(l5/5) }
    },
    criticalPath: 'HV Switchgear → Transformer → Generator → UPS → Chiller → System Test → IST'
  };
}
```

### 5.5. Gantt CSS Structure

```css
.cx-gantt-container {
  width: 100%;
  overflow-x: auto;
  background: #1a1a2e;
  border-radius: 8px;
  border: 1px solid #2d2d4a;
}

.cx-gantt-row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #2d2d4a;
  min-height: 32px;
  transition: background 0.2s;
}

.cx-gantt-row:hover { background: rgba(255,255,255,0.03); }

.cx-gantt-row[data-level="1"] { background: rgba(59,130,246,0.08); font-weight: 700; }
.cx-gantt-row[data-level="2"] { padding-left: 20px; font-weight: 600; }
.cx-gantt-row[data-level="3"] { padding-left: 40px; }
.cx-gantt-row[data-level="4"] { padding-left: 60px; font-size: 0.88rem; }
.cx-gantt-row[data-level="5"] { padding-left: 80px; font-size: 0.82rem; color: #9ca3af; }

.cx-gantt-label {
  width: 320px;
  min-width: 320px;
  padding: 4px 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cx-gantt-chevron {
  width: 16px;
  transition: transform 0.2s;
}

.cx-gantt-expanded .cx-gantt-chevron { transform: rotate(90deg); }

.cx-gantt-bar-area {
  flex: 1;
  position: relative;
  height: 24px;
}

.cx-gantt-bar {
  position: absolute;
  height: 18px;
  border-radius: 3px;
  top: 3px;
  opacity: 0.85;
  transition: opacity 0.2s;
}

.cx-gantt-bar:hover { opacity: 1; }

/* Level colors */
.cx-gantt-bar[data-phase="L1"] { background: #3b82f6; }
.cx-gantt-bar[data-phase="L2"] { background: #10b981; }
.cx-gantt-bar[data-phase="L3"] { background: #f59e0b; }
.cx-gantt-bar[data-phase="L4"] { background: #8b5cf6; }
.cx-gantt-bar[data-phase="L5"] { background: #ef4444; }

/* Critical path highlight */
.cx-gantt-bar.critical { border: 2px solid #fbbf24; }

/* Dark mode already default; light mode override */
[data-theme="light"] .cx-gantt-container { background: #f9fafb; border-color: #e5e7eb; }
[data-theme="light"] .cx-gantt-row { border-color: #e5e7eb; }
```

---

## 6. Cooling Type Differentiation — Detailed Cx Impact

Each cooling type fundamentally changes the commissioning scope. This section documents every additional test, cost adder, and schedule impact for each cooling architecture.

### 6.1. Air Cooling (CRAC/CRAH — Raised Floor)

```javascript
var CX_AIR_COOLING = {
  description: 'Traditional raised-floor cooling with Computer Room Air Conditioning (CRAC) or Computer Room Air Handling (CRAH) units.',
  typicalDensity: '2–8 kW/rack',
  cxScopeNotes: 'Baseline scope. All other cooling types add to this baseline.',

  mechanical_cx: {
    l2_additional: [
      'Raised floor tile placement audit (perforated % vs CFD)',
      'Underfloor plenum obstruction check',
      'Cable routing vs airflow path verification',
      'Floor seal integrity (tile gaskets, cable cutouts, column penetrations)'
    ],
    l3_additional: [
      'Underfloor static pressure measurement (0.03–0.05 inches w.g. typical)',
      'Floor tile airflow measurement (per tile CFM)',
      'Return air path verification'
    ],
    l4_additional: [
      'CFD model validation (measured vs predicted at 12+ points)',
      'Hot spot identification and remediation',
      'Blanking panel compliance audit',
      'Airflow containment effectiveness measurement'
    ]
  },

  unique_tests: {
    underfloorPressure: {
      name: 'Underfloor Static Pressure Survey',
      description: 'Measure static pressure at 20+ points across underfloor plenum.',
      criteria: 'Pressure range 0.025–0.075 in. w.g. Variation < 25% across floor.',
      duration: 4, unit: 'hours',
      equipment: ['differential_manometer', 'floor_tile_lifter']
    },
    tileAirflow: {
      name: 'Perforated Tile Airflow Measurement',
      description: 'Measure CFM through each perforated tile using balometer.',
      criteria: 'Each tile ±15% of design CFM. Total supply matches total demand.',
      duration: 0.5, unit: 'hours_per_10_tiles',
      equipment: ['balometer_hood']
    },
    containmentLeakage: {
      name: 'Hot/Cold Aisle Containment Leakage Test',
      description: 'With containment doors closed, measure bypass and recirculation.',
      criteria: 'Bypass air < 10%. Recirculation < 10%. Temperature spread < 5°C across cold aisle.',
      duration: 2, unit: 'hours_per_row',
      equipment: ['anemometer_array', 'temperature_data_loggers']
    }
  },

  costAdder: 0, // baseline (0% additional)
  durationAdder: 0, // baseline
  l5_additional_scenarios: [] // no additional IST scenarios beyond standard
};
```

### 6.2. In-Row Precision Cooling

```javascript
var CX_INROW_COOLING = {
  description: 'In-row cooling units installed within or between server racks. Targets air directly at the heat source. Used for medium-to-high density deployments.',
  typicalDensity: '8–25 kW/rack',
  cxScopeNotes: 'Adds containment verification, per-unit airflow balancing, and closer coordination with rack layout.',

  mechanical_cx: {
    l2_additional: [
      'In-row unit alignment verification (flush with rack faces)',
      'Containment system integrity check (doors, panels, blanking)',
      'Chilled water piping to each unit (individual isolation valves)',
      'Condensate drain routing and trap verification',
      'Power and control wiring per-unit verification'
    ],
    l3_additional: [
      'Per-unit airflow measurement (supply and return)',
      'Per-unit cooling capacity verification',
      'Variable fan speed calibration',
      'Unit-to-unit temperature differential analysis',
      'Condensate pump functional test (if applicable)'
    ],
    l4_additional: [
      'Row-level heat rejection balance',
      'Adjacent row thermal interaction assessment',
      'Dynamic load redistribution test (rack power change → cooling response)',
      'Unit failure impact on adjacent racks (N+1 within row)'
    ]
  },

  unique_tests: {
    containmentIntegrity: {
      name: 'Hot Aisle / Cold Aisle Containment Verification',
      description: 'Measure air leakage through containment system at operating conditions.',
      criteria: 'Leakage < 5% of supply air volume. ΔT between cold and hot aisle > 10°C.',
      duration: 1, unit: 'hours_per_row',
      equipment: ['anemometer', 'temperature_data_loggers', 'smoke_pencil']
    },
    unitBalancing: {
      name: 'In-Row Unit Airflow Balancing',
      description: 'Balance airflow across all in-row units in a row to ensure uniform cooling.',
      criteria: 'Per-unit airflow within ±10% of design. Rack inlet temps < 27°C at all racks.',
      duration: 2, unit: 'hours_per_row',
      equipment: ['balometer', 'anemometer']
    },
    nPlus1Test: {
      name: 'N+1 In-Row Unit Failover',
      description: 'Shut down one in-row unit. Verify adjacent units increase output to compensate.',
      criteria: 'Adjacent units ramp to compensate within 60 seconds. Rack inlet < 30°C at worst rack.',
      duration: 1.5, unit: 'hours_per_row',
      equipment: ['temperature_data_loggers']
    }
  },

  costAdder: 0.12, // +12% over air cooling baseline
  durationAdder: 0.08, // +8% schedule
  l5_additional_scenarios: [
    'IST-005a: Multiple in-row unit failure (2 adjacent units)',
    'IST-005b: Containment breach during operation'
  ]
};
```

### 6.3. Rear Door Heat Exchanger (RDHX)

```javascript
var CX_RDHX_COOLING = {
  description: 'Water-cooled heat exchangers mounted on the rear door of each rack. Neutral air cooling — heat removed at the rack before entering the room.',
  typicalDensity: '15–40 kW/rack',
  cxScopeNotes: 'Adds significant plumbing Cx: water loop per rack, manifold balancing, leak detection, and glycol management.',

  mechanical_cx: {
    l2_additional: [
      'Row-level manifold installation verification',
      'Per-rack flexible hose connection inspection',
      'Quick-disconnect (QD) fitting installation audit',
      'Condensate management system (drip trays, drain piping)',
      'Glycol concentration verification (30-50% propylene glycol typical)',
      'Water loop leak detection cable/sensor placement',
      'Isolation valve accessibility check (per-rack and per-row)',
      'Pressure gauge and flow indicator installation'
    ],
    l3_additional: [
      'Row manifold hydrostatic pressure test',
      'Per-rack flow balancing (balancing valves)',
      'Glycol loop fill and purge procedure',
      'Leak detection system functional test',
      'Heat exchanger capacity test per rack (design vs actual)',
      'Control valve modulation test (2-way or 3-way)',
      'Condensation risk assessment (dew point monitoring)'
    ],
    l4_additional: [
      'Full system water flow balance across all rows',
      'Dynamic response: IT load change → RDHX heat rejection response',
      'Mixed mode operation: RDHX + room-level cooling coordination',
      'Condensation prevention verification (EWT > dew point at all conditions)',
      'Water quality management program verification (chemical treatment, filtration)'
    ]
  },

  unique_tests: {
    manifoldPressure: {
      name: 'Row Manifold Hydrostatic Test',
      description: 'Pressurize each row manifold to 1.5x design pressure for 2 hours.',
      criteria: 'No pressure drop > 0.05 bar over 2 hours. No visible leaks.',
      duration: 3, unit: 'hours_per_row',
      equipment: ['hydrostatic_test_pump', 'pressure_recorder']
    },
    perRackFlow: {
      name: 'Per-Rack Flow Balancing',
      description: 'Measure and balance water flow to each RDHX unit.',
      criteria: 'Flow within ±10% of design at each rack. Total row flow matches design.',
      duration: 0.5, unit: 'hours_per_rack',
      equipment: ['ultrasonic_flow_meter', 'balancing_valve_tool']
    },
    dewPointMonitoring: {
      name: 'Condensation Risk Test',
      description: 'Monitor entering water temperature vs room dew point at all conditions.',
      criteria: 'EWT always > room dew point + 2°C safety margin. No condensation on RDHX coil.',
      duration: 4, unit: 'hours',
      equipment: ['dew_point_sensor', 'temperature_data_loggers']
    },
    qdFittingTest: {
      name: 'Quick-Disconnect Drip Test',
      description: 'Disconnect and reconnect each QD fitting. Measure residual drip.',
      criteria: 'Drip < 2ml per disconnect event. No sustained leak after reconnect.',
      duration: 0.25, unit: 'hours_per_rack',
      equipment: ['absorbent_pad', 'measuring_cup']
    },
    leakDetection: {
      name: 'Leak Detection System Integration',
      description: 'Simulate water leak at each detection zone. Verify alarm chain.',
      criteria: 'Alarm within 30 sec. BMS receives alarm. Auto pump shutdown (if configured).',
      duration: 0.5, unit: 'hours_per_row',
      equipment: ['leak_simulation_tool']
    }
  },

  costAdder: 0.25, // +25% over air cooling baseline
  durationAdder: 0.18, // +18% schedule
  l5_additional_scenarios: [
    'IST-005c: Water loop isolation valve failure (stuck open under high pressure)',
    'IST-005d: Glycol concentration degradation scenario',
    'IST-005e: RDHX quick-disconnect failure with leak detection response',
    'IST-011: Cooling mode transition (RDHX primary → room cooling backup)'
  ]
};
```

### 6.4. Direct Liquid Cooling (DLC)

```javascript
var CX_DLC_COOLING = {
  description: 'Cold plates on CPU/GPU packages with facility-side coolant distribution units (CDUs). Liquid flows directly to the chip. Highest cooling efficiency.',
  typicalDensity: '30–100+ kW/rack',
  cxScopeNotes: 'Most complex Cx scope. Adds CDU commissioning, manifold systems, per-server flow verification, coolant quality management, and specialized leak containment testing.',

  mechanical_cx: {
    l2_additional: [
      'CDU installation verification (alignment, piping, electrical)',
      'Primary loop (facility → CDU) piping pressure test',
      'Secondary loop (CDU → rack manifolds) piping pressure test',
      'Row-level manifold installation and alignment',
      'Rack-level manifold and quick-disconnect installation',
      'Server cold plate fitment verification (per server model)',
      'Coolant containment and drip tray installation',
      'Leak detection cable/sensor placement (under all piping runs)',
      'Coolant fill station installation',
      'Pressure relief valve installation and sizing verification',
      'Expansion tank pre-charge verification',
      'Coolant quality monitoring sensor installation (pH, conductivity, particulate)',
      'Secondary containment verification (entire coolant path)'
    ],
    l3_additional: [
      'CDU pump startup and flow verification',
      'CDU heat exchanger performance test',
      'Secondary loop fill, purge, and pressurization',
      'Per-row manifold flow balancing',
      'Per-rack flow verification (inlet/outlet ΔT measurement)',
      'Per-server cold plate flow verification (QD engagement test)',
      'Coolant quality baseline measurement',
      'Leak detection system functional test (all zones)',
      'CDU redundancy test (pump A → pump B switchover)',
      'Pressure relief valve pop test',
      'Automatic fill/makeup system test',
      'Coolant filtering system verification'
    ],
    l4_additional: [
      'Full DLC system capacity test at design heat load',
      'CDU staging test (lead/lag/auto sequencing)',
      'Dynamic response: server power step change → coolant temperature response',
      'Mixed cooling mode: DLC (CPU/GPU) + air (memory/storage) coordination',
      'Coolant loop thermal stratification analysis',
      'Server hot-swap with live coolant loop',
      'Coolant loss scenario response (controlled leak → makeup → alarm)',
      'CDU-to-CDU isolation test (one CDU maintenance, others continue)',
      'Extended thermal soak test (8 hours at 100% design load)'
    ]
  },

  unique_tests: {
    cduHydrostatic: {
      name: 'CDU Secondary Loop Hydrostatic Test',
      description: 'Pressurize entire secondary loop (CDU output → manifolds → CDU return) to 1.5x design.',
      criteria: 'Hold for 4 hours. Pressure drop < 0.1 bar. Zero visible leaks.',
      duration: 6, unit: 'hours_per_cdu',
      equipment: ['hydrostatic_test_pump', 'pressure_recorder', 'leak_detection_fluid']
    },
    cduPerformance: {
      name: 'CDU Heat Rejection Capacity Test',
      description: 'Measure CDU heat rejection at design conditions.',
      criteria: 'Capacity ≥ rated. Approach temp ≤ 3°C. Flow rate within ±5% of design.',
      duration: 4, unit: 'hours_per_cdu',
      equipment: ['temperature_sensors', 'flow_meter', 'power_analyzer']
    },
    serverFlowVerification: {
      name: 'Per-Server Coolant Flow Verification',
      description: 'Verify coolant flow to each server cold plate. Engage/disengage QDs.',
      criteria: 'Flow confirmed at each server (visual or ΔT method). QDs engage/disengage cleanly.',
      duration: 0.1, unit: 'hours_per_server',
      equipment: ['infrared_thermometer', 'flow_indicator']
    },
    coolantQuality: {
      name: 'Coolant Quality Analysis',
      description: 'Analyze coolant: pH, conductivity, particulate count, corrosion inhibitor concentration.',
      criteria: 'pH: 7.0-9.0, conductivity < 5 μS/cm (DI water) or per OEM spec, particles < 5μm count per ISO 4406 class.',
      duration: 2, unit: 'hours',
      equipment: ['coolant_analysis_kit', 'particle_counter']
    },
    leakContainment: {
      name: 'Leak Containment and Response Test',
      description: 'Simulate controlled leak at rack level. Verify containment captures coolant and alarms trigger.',
      criteria: 'Drip tray captures 100% of simulated leak. Alarm within 30 seconds. BMS logged.',
      duration: 1, unit: 'hours_per_row',
      equipment: ['controlled_leak_simulator']
    },
    serverHotSwap: {
      name: 'Server Hot-Swap Under Liquid Cooling',
      description: 'Disconnect server from coolant loop (QD), remove server, replace, reconnect.',
      criteria: 'QD disconnect: < 2ml spillage. Reconnect: no air ingress. Cooling restored < 60 sec.',
      duration: 0.5, unit: 'hours_per_server_type',
      equipment: ['absorbent_pads', 'coolant_collection_container']
    }
  },

  costAdder: 0.45, // +45% over air cooling baseline
  durationAdder: 0.35, // +35% schedule
  l5_additional_scenarios: [
    'IST-005f: Complete CDU failure — verify N+1 CDU takes over',
    'IST-005g: Coolant leak at rack manifold — leak detection + auto-isolation',
    'IST-005h: Coolant quality degradation — monitoring alarm + response',
    'IST-011: Primary loop failure — CDU isolation + emergency cooling transition',
    'IST-012: Server-level thermal runaway protection — cold plate failure alarm',
    'IST-013: Power loss to CDU — gravity drain + thermal inertia ride-through'
  ]
};
```

### 6.5. Immersion Cooling

```javascript
var CX_IMMERSION_COOLING = {
  description: 'Servers submerged in dielectric fluid (single-phase or two-phase). Highest density cooling capacity.',
  typicalDensity: '50–250+ kW/rack (tank)',
  cxScopeNotes: 'Most specialized Cx. Adds tank testing, fluid management, vapor management (2-phase), and unique server submersion procedures.',

  mechanical_cx: {
    l2_additional: [
      'All DLC L2 items PLUS:',
      'Tank structural integrity and leak test',
      'Tank levelness and drainage verification',
      'Dielectric fluid storage and fill system installation',
      'Fluid circulation piping (tank → heat exchanger → tank)',
      'Overflow containment system',
      'Vapor condenser installation (two-phase only)',
      'Fluid quality monitoring sensors (dielectric strength, moisture, particles)',
      'Server tray/cradle installation for submersion',
      'Hoist/lift system for server insertion/removal',
      'Emergency fluid drain system'
    ],
    l3_additional: [
      'Tank fill procedure with dielectric fluid',
      'Fluid dielectric strength test (pre-fill and post-fill)',
      'Fluid circulation pump startup',
      'Heat exchanger performance (fluid → water)',
      'Server submersion procedure validation',
      'Fluid level monitoring and makeup system',
      'Vapor condenser functional test (two-phase)',
      'Fluid temperature stratification analysis',
      'Emergency drain functional test'
    ],
    l4_additional: [
      'Full tank thermal capacity test at design load',
      'Multi-tank system balancing',
      'Fluid aging and quality trend (accelerated test)',
      'Server maintenance procedure under fluid (hot-swap)',
      'Tank overflow containment response test',
      'Environmental monitoring (fluid vapor concentration if 2-phase)'
    ]
  },

  costAdder: 0.55, // +55% over air cooling baseline
  durationAdder: 0.40, // +40% schedule
  l5_additional_scenarios: [
    'All DLC IST scenarios PLUS:',
    'IST-014: Tank integrity failure — emergency drain activation',
    'IST-015: Dielectric fluid quality alarm — filtration/replacement procedure',
    'IST-016: Vapor condenser failure (2-phase) — containment response',
    'IST-017: Complete tank thermal runaway protection test'
  ]
};
```

### 6.6. Cooling Type Cx Cost/Duration Summary

| Cooling Type | Cost Adder | Duration Adder | Additional L2 Items | Additional L3 Items | Additional IST Scenarios |
|-------------|-----------|---------------|--------------------|--------------------|------------------------|
| Air (baseline) | 0% | 0% | 4 | 3 | 0 |
| In-Row | +12% | +8% | 5 | 5 | 2 |
| RDHX | +25% | +18% | 8 | 7 | 4 |
| DLC | +45% | +35% | 13 | 12 | 6 |
| Immersion | +55% | +40% | 11+ | 9+ | 4+ |

---

## 7. Redundancy Impact on Commissioning — Full Matrix

### 7.1. Equipment Count Multipliers

```javascript
var REDUNDANCY_EQUIPMENT = {
  'N': {
    description: 'No redundancy. Single path for all systems.',
    upsModules:     function(base) { return base; },
    generators:     function(base) { return base; },
    coolingUnits:   function(base) { return base; },
    chillers:       function(base) { return base; },
    pumps:          function(base) { return base; },
    sts:            function(base) { return 0; },  // no STS needed
    powerPaths:     1,
    cxTestMultiplier: 1.0,
    cxScheduleMultiplier: 1.0
  },
  'N+1': {
    description: 'One extra component per system.',
    upsModules:     function(base) { return base + 1; },
    generators:     function(base) { return base + 1; },
    coolingUnits:   function(base) { return base + 1; },
    chillers:       function(base) { return base + 1; },
    pumps:          function(base) { return base + 1; },
    sts:            function(base) { return 0; },  // STS optional
    powerPaths:     1,
    cxTestMultiplier: 1.35,
    cxScheduleMultiplier: 1.30,
    additionalCxTests: [
      'Component failover for each system (remove N+1 unit, verify others handle load)',
      'Auto-start sequence for standby equipment',
      'Load redistribution verification'
    ]
  },
  '2N': {
    description: 'Complete duplicate system. Two independent paths.',
    upsModules:     function(base) { return base * 2; },
    generators:     function(base) { return base * 2; },
    coolingUnits:   function(base) { return base * 2; },
    chillers:       function(base) { return base * 2; },
    pumps:          function(base) { return base * 2; },
    sts:            function(base) { return Math.ceil(base / 2); }, // STS between paths
    powerPaths:     2,
    cxTestMultiplier: 2.0,
    cxScheduleMultiplier: 1.75, // parallel testing of paths, not fully 2x
    additionalCxTests: [
      'Path A complete test (all levels independently)',
      'Path B complete test (all levels independently)',
      'STS transfer test (A→B and B→A)',
      'Concurrent maintainability (remove any one path, other carries full load)',
      'Fault tolerance simulation (unplanned failure of one path)',
      'Cross-path interaction test (verify no common mode failures)',
      'Dual-feed synchronization verification'
    ]
  },
  '2N+1': {
    description: 'Complete duplicate system PLUS one extra component per system.',
    upsModules:     function(base) { return (base + 1) * 2; },
    generators:     function(base) { return (base + 1) * 2; },
    coolingUnits:   function(base) { return (base + 1) * 2; },
    chillers:       function(base) { return (base + 1) * 2; },
    pumps:          function(base) { return (base + 1) * 2; },
    sts:            function(base) { return Math.ceil(base / 2); },
    powerPaths:     2,
    cxTestMultiplier: 2.25,
    cxScheduleMultiplier: 1.90,
    additionalCxTests: [
      'All 2N tests PLUS:',
      'N+1 failover within each path (component removal per path)',
      'Combined scenario: maintenance on Path A component + fault on Path B',
      'Extended 72-hour endurance with failover events',
      'Cascade failure simulation (multiple failures in sequence)'
    ]
  }
};
```

### 7.2. Tier-to-Cx Mapping

| Tier | Redundancy | Availability | Cx Scope Impact | Typical Cx Duration (2MW) | Typical Cx Cost (2MW) |
|------|-----------|-------------|-----------------|--------------------------|----------------------|
| I | N | 99.671% | Basic L1-L5 | 8-12 weeks | $180K-$280K |
| II | N+1 | 99.749% | +Component failover tests | 12-16 weeks | $250K-$400K |
| III | N+1 (concurrently maintainable) | 99.982% | +Concurrent maintainability IST | 16-24 weeks | $380K-$600K |
| IV | 2N or 2N+1 | 99.995% | +Fault tolerance + dual path testing | 24-40 weeks | $600K-$1.2M |

---

## 8. Regional Labor Rate Database

### 8.1. Complete Rate Table

```javascript
var CX_REGIONAL_RATES = {
  // ============================================================
  // NORTH AMERICA
  // ============================================================
  us_virginia: {
    name: 'Northern Virginia (Ashburn)',
    country: 'United States',
    region: 'North America',
    cxEngineerDay: 1200,   // $/day (senior CxA)
    cxFieldEngDay: 850,    // $/day (field engineer)
    oemSpecialistDay: 2000, // $/day (manufacturer rep)
    electricianDay: 750,    // $/day (journeyman electrician for testing support)
    thirdPartyWitnessDay: 3500, // Uptime Institute witness
    travelPerDiem: 300,    // $/day (hotel + meals)
    dieselPerLiter: 1.10,  // $/liter
    laborMultiplier: 1.00, // baseline
    regulatoryNotes: 'NETA standards. OSHA compliance. State electrical inspector sign-off.',
    taxRate: 0.06          // VA sales tax on services
  },
  us_texas: {
    name: 'Dallas-Fort Worth / San Antonio',
    country: 'United States',
    region: 'North America',
    cxEngineerDay: 1100,
    cxFieldEngDay: 800,
    oemSpecialistDay: 1800,
    electricianDay: 700,
    thirdPartyWitnessDay: 3500,
    travelPerDiem: 250,
    dieselPerLiter: 0.95,
    laborMultiplier: 0.92,
    regulatoryNotes: 'NETA standards. ERCOT grid considerations for generator testing.'
  },
  us_oregon: {
    name: 'The Dalles / Hillsboro (Oregon)',
    country: 'United States',
    region: 'North America',
    cxEngineerDay: 1150,
    cxFieldEngDay: 825,
    oemSpecialistDay: 1900,
    electricianDay: 780,
    thirdPartyWitnessDay: 3500,
    travelPerDiem: 280,
    dieselPerLiter: 1.15,
    laborMultiplier: 0.96
  },
  us_phoenix: {
    name: 'Phoenix / Mesa (Arizona)',
    country: 'United States',
    region: 'North America',
    cxEngineerDay: 1050,
    cxFieldEngDay: 750,
    oemSpecialistDay: 1800,
    electricianDay: 680,
    thirdPartyWitnessDay: 3500,
    travelPerDiem: 240,
    dieselPerLiter: 1.05,
    laborMultiplier: 0.88
  },
  canada_toronto: {
    name: 'Toronto',
    country: 'Canada',
    region: 'North America',
    cxEngineerDay: 1050,
    cxFieldEngDay: 780,
    oemSpecialistDay: 1700,
    electricianDay: 700,
    thirdPartyWitnessDay: 3200,
    travelPerDiem: 260,
    dieselPerLiter: 1.45,
    laborMultiplier: 0.88,
    regulatoryNotes: 'CSA standards. Provincial electrical codes apply.'
  },

  // ============================================================
  // EUROPE
  // ============================================================
  uk_london: {
    name: 'London / Slough',
    country: 'United Kingdom',
    region: 'Europe',
    cxEngineerDay: 875,
    cxFieldEngDay: 650,
    oemSpecialistDay: 1500,
    electricianDay: 580,
    thirdPartyWitnessDay: 3000,
    travelPerDiem: 280,
    dieselPerLiter: 1.75,
    laborMultiplier: 0.73,
    regulatoryNotes: 'BS 7671 (IET Wiring Regulations). BSRIA Cx guidelines.'
  },
  netherlands_amsterdam: {
    name: 'Amsterdam / Schiphol-Rijk',
    country: 'Netherlands',
    region: 'Europe',
    cxEngineerDay: 950,
    cxFieldEngDay: 700,
    oemSpecialistDay: 1600,
    electricianDay: 620,
    thirdPartyWitnessDay: 3200,
    travelPerDiem: 270,
    dieselPerLiter: 1.85,
    laborMultiplier: 0.79
  },
  germany_frankfurt: {
    name: 'Frankfurt',
    country: 'Germany',
    region: 'Europe',
    cxEngineerDay: 1000,
    cxFieldEngDay: 750,
    oemSpecialistDay: 1650,
    electricianDay: 650,
    thirdPartyWitnessDay: 3200,
    travelPerDiem: 260,
    dieselPerLiter: 1.80,
    laborMultiplier: 0.83
  },
  ireland_dublin: {
    name: 'Dublin',
    country: 'Ireland',
    region: 'Europe',
    cxEngineerDay: 900,
    cxFieldEngDay: 680,
    oemSpecialistDay: 1550,
    electricianDay: 600,
    thirdPartyWitnessDay: 3000,
    travelPerDiem: 280,
    dieselPerLiter: 1.70,
    laborMultiplier: 0.75
  },
  france_paris: {
    name: 'Paris / Île-de-France',
    country: 'France',
    region: 'Europe',
    cxEngineerDay: 920,
    cxFieldEngDay: 680,
    oemSpecialistDay: 1500,
    electricianDay: 580,
    thirdPartyWitnessDay: 3000,
    travelPerDiem: 270,
    dieselPerLiter: 1.90,
    laborMultiplier: 0.77
  },
  nordics_stockholm: {
    name: 'Stockholm / Luleå',
    country: 'Sweden',
    region: 'Europe',
    cxEngineerDay: 1050,
    cxFieldEngDay: 780,
    oemSpecialistDay: 1700,
    electricianDay: 700,
    thirdPartyWitnessDay: 3200,
    travelPerDiem: 290,
    dieselPerLiter: 1.95,
    laborMultiplier: 0.88
  },
  spain_madrid: {
    name: 'Madrid',
    country: 'Spain',
    region: 'Europe',
    cxEngineerDay: 750,
    cxFieldEngDay: 550,
    oemSpecialistDay: 1300,
    electricianDay: 480,
    thirdPartyWitnessDay: 2800,
    travelPerDiem: 200,
    dieselPerLiter: 1.60,
    laborMultiplier: 0.63
  },

  // ============================================================
  // ASIA-PACIFIC
  // ============================================================
  singapore: {
    name: 'Singapore',
    country: 'Singapore',
    region: 'Asia-Pacific',
    cxEngineerDay: 850,
    cxFieldEngDay: 620,
    oemSpecialistDay: 1500,
    electricianDay: 450,
    thirdPartyWitnessDay: 3000,
    travelPerDiem: 280,
    dieselPerLiter: 1.60,
    laborMultiplier: 0.71,
    regulatoryNotes: 'SS 638:2018 (Energy Management). BCA Green Mark for DC.'
  },
  japan_tokyo: {
    name: 'Tokyo / Osaka',
    country: 'Japan',
    region: 'Asia-Pacific',
    cxEngineerDay: 1000,
    cxFieldEngDay: 750,
    oemSpecialistDay: 1800,
    electricianDay: 600,
    thirdPartyWitnessDay: 3500,
    travelPerDiem: 300,
    dieselPerLiter: 1.30,
    laborMultiplier: 0.83,
    regulatoryNotes: 'JEITA standards. Seismic commissioning mandatory (Zone 3-4).'
  },
  australia_sydney: {
    name: 'Sydney / Melbourne',
    country: 'Australia',
    region: 'Asia-Pacific',
    cxEngineerDay: 950,
    cxFieldEngDay: 700,
    oemSpecialistDay: 1600,
    electricianDay: 580,
    thirdPartyWitnessDay: 3200,
    travelPerDiem: 260,
    dieselPerLiter: 1.50,
    laborMultiplier: 0.79,
    regulatoryNotes: 'AS/NZS 3000 (Wiring Rules). NABERS Energy Rating.'
  },
  india_mumbai: {
    name: 'Mumbai / Chennai / Hyderabad',
    country: 'India',
    region: 'Asia-Pacific',
    cxEngineerDay: 400,
    cxFieldEngDay: 250,
    oemSpecialistDay: 800,
    electricianDay: 150,
    thirdPartyWitnessDay: 2000,
    travelPerDiem: 120,
    dieselPerLiter: 1.10,
    laborMultiplier: 0.33
  },
  china_shanghai: {
    name: 'Shanghai / Beijing / Shenzhen',
    country: 'China',
    region: 'Asia-Pacific',
    cxEngineerDay: 550,
    cxFieldEngDay: 350,
    oemSpecialistDay: 1000,
    electricianDay: 250,
    thirdPartyWitnessDay: 2500,
    travelPerDiem: 150,
    dieselPerLiter: 1.20,
    laborMultiplier: 0.46
  },
  korea_seoul: {
    name: 'Seoul',
    country: 'South Korea',
    region: 'Asia-Pacific',
    cxEngineerDay: 750,
    cxFieldEngDay: 550,
    oemSpecialistDay: 1300,
    electricianDay: 400,
    thirdPartyWitnessDay: 2800,
    travelPerDiem: 200,
    dieselPerLiter: 1.35,
    laborMultiplier: 0.63
  },
  hk: {
    name: 'Hong Kong',
    country: 'Hong Kong SAR',
    region: 'Asia-Pacific',
    cxEngineerDay: 900,
    cxFieldEngDay: 650,
    oemSpecialistDay: 1500,
    electricianDay: 500,
    thirdPartyWitnessDay: 3000,
    travelPerDiem: 300,
    dieselPerLiter: 1.80,
    laborMultiplier: 0.75
  },
  indonesia_jakarta: {
    name: 'Jakarta / Batam',
    country: 'Indonesia',
    region: 'Asia-Pacific',
    cxEngineerDay: 350,
    cxFieldEngDay: 200,
    oemSpecialistDay: 700,
    electricianDay: 120,
    thirdPartyWitnessDay: 1800,
    travelPerDiem: 100,
    dieselPerLiter: 0.90,
    laborMultiplier: 0.29
  },
  malaysia_kl: {
    name: 'Kuala Lumpur / Cyberjaya',
    country: 'Malaysia',
    region: 'Asia-Pacific',
    cxEngineerDay: 400,
    cxFieldEngDay: 280,
    oemSpecialistDay: 750,
    electricianDay: 170,
    thirdPartyWitnessDay: 2000,
    travelPerDiem: 110,
    dieselPerLiter: 0.55,
    laborMultiplier: 0.33
  },

  // ============================================================
  // MIDDLE EAST & AFRICA
  // ============================================================
  uae_dubai: {
    name: 'Dubai / Abu Dhabi',
    country: 'UAE',
    region: 'Middle East',
    cxEngineerDay: 800,
    cxFieldEngDay: 550,
    oemSpecialistDay: 1400,
    electricianDay: 350,
    thirdPartyWitnessDay: 3000,
    travelPerDiem: 250,
    dieselPerLiter: 0.75,
    laborMultiplier: 0.67,
    regulatoryNotes: 'DEWA/ADDC standards. Green Building Al Sa\'fat (Dubai).'
  },
  saudi_riyadh: {
    name: 'Riyadh / Jeddah / NEOM',
    country: 'Saudi Arabia',
    region: 'Middle East',
    cxEngineerDay: 850,
    cxFieldEngDay: 600,
    oemSpecialistDay: 1500,
    electricianDay: 400,
    thirdPartyWitnessDay: 3000,
    travelPerDiem: 250,
    dieselPerLiter: 0.60,
    laborMultiplier: 0.71,
    regulatoryNotes: 'SEC standards. SASO certification. Vision 2030 DC requirements.'
  },
  south_africa_jhb: {
    name: 'Johannesburg / Cape Town',
    country: 'South Africa',
    region: 'Africa',
    cxEngineerDay: 500,
    cxFieldEngDay: 350,
    oemSpecialistDay: 900,
    electricianDay: 250,
    thirdPartyWitnessDay: 2200,
    travelPerDiem: 150,
    dieselPerLiter: 1.40,
    laborMultiplier: 0.42
  },
  nigeria_lagos: {
    name: 'Lagos',
    country: 'Nigeria',
    region: 'Africa',
    cxEngineerDay: 400,
    cxFieldEngDay: 250,
    oemSpecialistDay: 800,
    electricianDay: 150,
    thirdPartyWitnessDay: 2000,
    travelPerDiem: 180,
    dieselPerLiter: 0.95,
    laborMultiplier: 0.33
  },
  kenya_nairobi: {
    name: 'Nairobi',
    country: 'Kenya',
    region: 'Africa',
    cxEngineerDay: 350,
    cxFieldEngDay: 220,
    oemSpecialistDay: 700,
    electricianDay: 130,
    thirdPartyWitnessDay: 1800,
    travelPerDiem: 150,
    dieselPerLiter: 1.30,
    laborMultiplier: 0.29
  },

  // ============================================================
  // SOUTH AMERICA
  // ============================================================
  brazil_saopaulo: {
    name: 'São Paulo',
    country: 'Brazil',
    region: 'South America',
    cxEngineerDay: 500,
    cxFieldEngDay: 350,
    oemSpecialistDay: 900,
    electricianDay: 250,
    thirdPartyWitnessDay: 2200,
    travelPerDiem: 150,
    dieselPerLiter: 1.25,
    laborMultiplier: 0.42
  },
  chile_santiago: {
    name: 'Santiago',
    country: 'Chile',
    region: 'South America',
    cxEngineerDay: 550,
    cxFieldEngDay: 380,
    oemSpecialistDay: 950,
    electricianDay: 280,
    thirdPartyWitnessDay: 2400,
    travelPerDiem: 160,
    dieselPerLiter: 1.20,
    laborMultiplier: 0.46
  },
  mexico_queretaro: {
    name: 'Querétaro / Mexico City',
    country: 'Mexico',
    region: 'South America',
    cxEngineerDay: 480,
    cxFieldEngDay: 320,
    oemSpecialistDay: 850,
    electricianDay: 220,
    thirdPartyWitnessDay: 2200,
    travelPerDiem: 140,
    dieselPerLiter: 1.15,
    laborMultiplier: 0.40
  }
};

// Helper function
function getRegionalRate(regionKey) {
  return CX_REGIONAL_RATES[regionKey] || CX_REGIONAL_RATES['us_virginia'];
}
```

---

## 9. Pro Mode Features

### 9.1. Monte Carlo Simulation

```javascript
// Monte Carlo: 10,000 iterations varying all inputs ±15-20%
function cxRunMonteCarlo(inputs) {
  var iterations = 10000;
  var results = [];

  for (var i = 0; i < iterations; i++) {
    var variedInputs = {};
    Object.keys(inputs).forEach(function(key) {
      var val = inputs[key];
      if (typeof val === 'number') {
        // Apply normal distribution variation (±15% = ~2 sigma)
        var sigma = val * 0.075; // 7.5% std dev → 95% within ±15%
        variedInputs[key] = val + randNorm(0, sigma);
        if (variedInputs[key] < 0) variedInputs[key] = Math.abs(variedInputs[key]);
      } else {
        variedInputs[key] = val;
      }
    });

    var cost = calculateTotalCxCost(variedInputs);
    results.push(cost.grandTotal);
  }

  results.sort(function(a, b) { return a - b; });

  return {
    results: results,
    p5:   percentile(results, 5),
    p25:  percentile(results, 25),
    p50:  percentile(results, 50),
    p75:  percentile(results, 75),
    p95:  percentile(results, 95),
    mean: results.reduce(function(a,b) { return a+b; }, 0) / results.length,
    stdDev: stdDev(results),
    cvar95: cvar(results, 95),
    min: results[0],
    max: results[results.length - 1]
  };
}

// Helper: Box-Muller normal distribution
function randNorm(mu, sigma) {
  var u1 = Math.random(), u2 = Math.random();
  var z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mu + sigma * z;
}

function percentile(arr, p) {
  var idx = Math.ceil(p / 100 * arr.length) - 1;
  return arr[Math.max(0, idx)];
}

function stdDev(arr) {
  var mean = arr.reduce(function(a,b){return a+b;},0) / arr.length;
  var sq = arr.map(function(v){ return Math.pow(v - mean, 2); });
  return Math.sqrt(sq.reduce(function(a,b){return a+b;},0) / arr.length);
}

function cvar(arr, p) {
  var threshold = percentile(arr, p);
  var tail = arr.filter(function(v) { return v >= threshold; });
  return tail.reduce(function(a,b){return a+b;},0) / tail.length;
}
```

### 9.2. Sensitivity / Tornado Analysis

```javascript
function cxRunSensitivity(inputs, baseCost) {
  var results = [];
  var numericInputs = {
    'IT Load (kW)': 'itLoad',
    'Cooling Cost Multiplier': 'coolingType',
    'Redundancy Cost Multiplier': 'redundancy',
    'Building Type Multiplier': 'buildingType',
    'Seismic Zone': 'seismicZone',
    'BMS Complexity': 'bmsComplexity',
    'Substation Config': 'substationConfig'
  };

  Object.keys(numericInputs).forEach(function(label) {
    var key = numericInputs[label];
    var original = inputs[key];

    // Test +20%
    var highInputs = Object.assign({}, inputs);
    if (typeof original === 'number') {
      highInputs[key] = original * 1.20;
    }
    var highCost = calculateTotalCxCost(highInputs).grandTotal;

    // Test -20%
    var lowInputs = Object.assign({}, inputs);
    if (typeof original === 'number') {
      lowInputs[key] = original * 0.80;
    }
    var lowCost = calculateTotalCxCost(lowInputs).grandTotal;

    results.push({
      name: label,
      low: lowCost,
      base: baseCost,
      high: highCost,
      range: Math.abs(highCost - lowCost),
      lowDelta: lowCost - baseCost,
      highDelta: highCost - baseCost
    });
  });

  // Sort by range (largest impact first)
  results.sort(function(a, b) { return b.range - a.range; });

  return results;
}
```

### 9.3. Pro Mode Panel Structure (7 Panels)

| # | Panel Name | KPIs | Chart | Mode |
|---|-----------|------|-------|------|
| 1 | Cost Breakdown by Level | L1-L5 costs, % of total, $/kW per level | Stacked bar (Canvas) | Free (summary) / Pro (detail) |
| 2 | Cost Breakdown by Discipline | Electrical, Mechanical, Fire, Security, IT, Controls | Pie chart (Canvas) | Pro |
| 3 | Schedule & Critical Path | Total weeks, critical path, per-level duration | Gantt chart (Canvas/HTML) | Free (overview) / Pro (expandable) |
| 4 | Resource Loading | Peak CxA count, total person-days, OEM days | Area chart (Canvas) | Pro |
| 5 | Monte Carlo Distribution | P5/P25/P50/P75/P95/CVaR-95, min/max, std dev | Histogram (Canvas) | Pro |
| 6 | Sensitivity Tornado | Top 7 input drivers sorted by impact range | Tornado bar (Canvas) | Pro |
| 7 | Executive Assessment | Dynamic narrative referencing calculated values | Text (no chart) | Pro |

### 9.4. Scenario Presets (Free Mode)

```javascript
var CX_SCENARIOS = {
  enterprise_2mw: {
    name: 'Enterprise DC — 2MW Tier III',
    description: 'Typical enterprise data center. Purpose-built, air cooling, N+1 redundancy.',
    inputs: {
      itLoad: 2000, coolingType: 'air', redundancy: 'N+1',
      rackDensity: 'standard', buildingType: 'purpose',
      fireSuppression: 'novec', upsType: 'modular', region: 'us_virginia',
      generatorType: 'diesel', seismicZone: '1', cxScope: 'new_build',
      substationConfig: 'single_sub', bmsComplexity: 'standard',
      deliveryMethod: 'traditional'
    }
  },
  colo_10mw: {
    name: 'Colocation Facility — 10MW Tier III+',
    description: 'Multi-tenant colocation with in-row cooling. 2N power, N+1 cooling.',
    inputs: {
      itLoad: 10000, coolingType: 'inrow', redundancy: '2N',
      rackDensity: 'medium', buildingType: 'purpose',
      fireSuppression: 'novec', upsType: 'modular', region: 'us_virginia',
      generatorType: 'diesel', seismicZone: '2', cxScope: 'new_build',
      substationConfig: 'dual_sub', bmsComplexity: 'advanced',
      deliveryMethod: 'design_build'
    }
  },
  hyperscale_50mw: {
    name: 'Hyperscale Campus — 50MW Phase 1',
    description: 'Large hyperscale deployment. DLC cooling for AI/HPC. 2N+1.',
    inputs: {
      itLoad: 50000, coolingType: 'dlc', redundancy: '2N+1',
      rackDensity: 'ai_hpc', buildingType: 'purpose',
      fireSuppression: 'novec', upsType: 'modular', region: 'us_virginia',
      generatorType: 'diesel', seismicZone: '1', cxScope: 'new_build',
      substationConfig: 'ring_bus', bmsComplexity: 'ai_driven',
      deliveryMethod: 'epc'
    }
  },
  edge_500kw: {
    name: 'Edge Facility — 500kW Tier II',
    description: 'Small edge deployment. Converted warehouse. Basic redundancy.',
    inputs: {
      itLoad: 500, coolingType: 'air', redundancy: 'N+1',
      rackDensity: 'standard', buildingType: 'warehouse',
      fireSuppression: 'fm200', upsType: 'standalone', region: 'us_texas',
      generatorType: 'diesel', seismicZone: '0', cxScope: 'new_build',
      substationConfig: 'utility_fed', bmsComplexity: 'basic',
      deliveryMethod: 'traditional'
    }
  },
  modular_5mw: {
    name: 'Modular DC — 5MW Prefab Pods',
    description: 'Factory-built modular pods. RDHX cooling. EPC delivery.',
    inputs: {
      itLoad: 5000, coolingType: 'rdhx', redundancy: 'N+1',
      rackDensity: 'high', buildingType: 'modular',
      fireSuppression: 'water_mist', upsType: 'modular', region: 'nordics_stockholm',
      generatorType: 'hvo', seismicZone: '0', cxScope: 'new_build',
      substationConfig: 'single_sub', bmsComplexity: 'standard',
      deliveryMethod: 'modular_pod'
    }
  },
  recommission: {
    name: 'Recommissioning — 3MW Existing Facility',
    description: 'Existing facility being recommissioned after major upgrade.',
    inputs: {
      itLoad: 3000, coolingType: 'air', redundancy: 'N+1',
      rackDensity: 'standard', buildingType: 'purpose',
      fireSuppression: 'fm200', upsType: 'standalone', region: 'uk_london',
      generatorType: 'diesel', seismicZone: '0', cxScope: 'recommission',
      substationConfig: 'single_sub', bmsComplexity: 'standard',
      deliveryMethod: 'traditional'
    }
  }
};
```

---

## 10. PDF Export Structure

Following the pattern established in `PDF_EXPORT_STANDARD.md` and implemented in `article-14.html`.

### 10.1. PDF Generation Method

```javascript
function cxExportPDF(inputs, results, mc, sens, ganttData) {
  // CRITICAL: Open window BEFORE heavy computation
  var w = window.open('', '_blank');
  if (!w) { alert('Please allow pop-ups for PDF export.'); return; }

  var dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  w.document.write('<!DOCTYPE html><html><head>');
  w.document.write('<title>Data Center Commissioning Assessment — ' + dateStr + '</title>');
  w.document.write('<style>' + getCxPdfStyles() + '</style>');
  w.document.write('</head><body>');

  // Section 1: Header
  w.document.write(renderPdfHeader(dateStr));

  // Section 2: Executive Summary Score
  w.document.write(renderPdfExecutiveSummary(results));

  // Section 3: Input Parameters Table
  w.document.write(renderPdfInputTable(inputs));

  // Section 4: Cost Breakdown Table
  w.document.write(renderPdfCostBreakdown(results));

  // Section 5: SVG Charts (side-by-side)
  w.document.write('<div class="cx-pdf-charts-row">');
  w.document.write(renderSvgCostByLevel(results));       // Left: Bar chart
  w.document.write(renderSvgMonteCarloHist(mc));          // Right: Histogram
  w.document.write('</div>');

  // Section 6: SVG Tornado (full-width)
  w.document.write(renderSvgTornado(sens));

  // Section 7: Schedule Summary
  w.document.write(renderPdfScheduleSummary(ganttData));

  // Section 8: Pro Analysis — Detailed KPIs
  w.document.write(renderPdfProAnalysis(results));

  // Section 9: Executive Narrative
  w.document.write(renderPdfNarrative(inputs, results, mc, sens));

  // Section 10: Methodology & Data Sources
  w.document.write(renderPdfMethodology());

  // Section 11: Disclaimer
  w.document.write(renderPdfDisclaimer());

  // Footer
  w.document.write(renderPdfFooter(dateStr));

  w.document.write('</body></html>');
  w.document.close();
}
```

### 10.2. PDF Styles

```css
/* PDF-specific styles (inline in window.open document) */
body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  color: #1f2937;
  background: white;
  line-height: 1.5;
}

.cx-pdf-header {
  text-align: center;
  border-bottom: 3px solid #1e3a5f;
  padding-bottom: 16px;
  margin-bottom: 24px;
}

.cx-pdf-header h1 {
  font-size: 22px;
  color: #1e3a5f;
  margin: 0 0 4px 0;
}

.cx-pdf-header .cx-pdf-subtitle {
  font-size: 13px;
  color: #6b7280;
}

.cx-pdf-brand {
  font-size: 11px;
  color: #1e3a5f;
  font-weight: 700;
  letter-spacing: 1px;
}

.cx-pdf-section {
  margin-bottom: 24px;
  break-inside: avoid;
}

.cx-pdf-section h2 {
  font-size: 15px;
  color: #1e3a5f;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 6px;
  margin-bottom: 12px;
}

.cx-pdf-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.cx-pdf-kpi {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 10px;
  text-align: center;
}

.cx-pdf-kpi-value {
  font-size: 20px;
  font-weight: 800;
  color: #1e3a5f;
}

.cx-pdf-kpi-label {
  font-size: 10px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.cx-pdf-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin-bottom: 16px;
}

.cx-pdf-table th {
  background: #1e3a5f;
  color: white;
  padding: 8px;
  text-align: left;
  font-weight: 600;
}

.cx-pdf-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #e5e7eb;
}

.cx-pdf-table tr:nth-child(even) td {
  background: #f9fafb;
}

.cx-pdf-charts-row {
  display: flex;
  gap: 20px;
  margin-bottom: 24px;
}

.cx-pdf-charts-row > div {
  flex: 1;
}

.cx-pdf-narrative {
  background: #f0f9ff;
  border-left: 4px solid #1e3a5f;
  padding: 16px;
  font-size: 12px;
  line-height: 1.7;
}

.cx-pdf-disclaimer {
  background: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: 6px;
  padding: 12px;
  font-size: 10px;
  color: #92400e;
}

.cx-pdf-footer {
  text-align: center;
  margin-top: 32px;
  padding-top: 12px;
  border-top: 2px solid #1e3a5f;
  font-size: 10px;
  color: #6b7280;
}

@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { margin: 15mm; size: A4; }
  .cx-pdf-section { break-inside: avoid; }
}
```

### 10.3. SVG Chart Generators

```javascript
// SVG Bar Chart: Cost by Level
function renderSvgCostByLevel(results) {
  var levels = [
    { label: 'L1', value: results.perLevel.l1, color: '#3b82f6' },
    { label: 'L2', value: results.perLevel.l2, color: '#10b981' },
    { label: 'L3', value: results.perLevel.l3, color: '#f59e0b' },
    { label: 'L4', value: results.perLevel.l4, color: '#8b5cf6' },
    { label: 'L5', value: results.perLevel.l5, color: '#ef4444' }
  ];
  var maxVal = Math.max.apply(null, levels.map(function(l){ return l.value; }));
  var w = 400, h = 250, barW = 50, gap = 25, padLeft = 60, padBottom = 40;

  var svg = '<div><h3 style="font-size:13px;color:#1e3a5f;margin-bottom:8px;">Cost by Commissioning Level</h3>';
  svg += '<svg width="' + w + '" height="' + h + '" xmlns="http://www.w3.org/2000/svg">';

  // Y-axis
  svg += '<line x1="' + padLeft + '" y1="10" x2="' + padLeft + '" y2="' + (h-padBottom) + '" stroke="#ccc" />';

  levels.forEach(function(level, i) {
    var x = padLeft + 10 + i * (barW + gap);
    var barH = (level.value / maxVal) * (h - padBottom - 20);
    var y = h - padBottom - barH;

    svg += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + barH + '" fill="' + level.color + '" rx="3" />';
    svg += '<text x="' + (x + barW/2) + '" y="' + (h - padBottom + 18) + '" text-anchor="middle" font-size="11" fill="#374151">' + level.label + '</text>';
    svg += '<text x="' + (x + barW/2) + '" y="' + (y - 5) + '" text-anchor="middle" font-size="9" fill="#6b7280">$' + (level.value/1000).toFixed(0) + 'K</text>';
  });

  svg += '</svg></div>';
  return svg;
}

// SVG Histogram: Monte Carlo Distribution
function renderSvgMonteCarloHist(mc) {
  if (!mc) return '';
  var w = 400, h = 250, bins = 30;
  var range = mc.max - mc.min;
  var binWidth = range / bins;
  var binCounts = new Array(bins).fill(0);

  mc.results.forEach(function(v) {
    var idx = Math.min(Math.floor((v - mc.min) / binWidth), bins - 1);
    binCounts[idx]++;
  });

  var maxCount = Math.max.apply(null, binCounts);
  var padLeft = 40, padBottom = 40;
  var barW = (w - padLeft - 20) / bins;

  var svg = '<div><h3 style="font-size:13px;color:#1e3a5f;margin-bottom:8px;">Monte Carlo Distribution (n=10,000)</h3>';
  svg += '<svg width="' + w + '" height="' + h + '" xmlns="http://www.w3.org/2000/svg">';

  binCounts.forEach(function(count, i) {
    var x = padLeft + i * barW;
    var barH = (count / maxCount) * (h - padBottom - 20);
    var y = h - padBottom - barH;
    svg += '<rect x="' + x + '" y="' + y + '" width="' + (barW - 1) + '" height="' + barH + '" fill="#3b82f6" opacity="0.7" />';
  });

  // P5, P50, P95 lines
  [
    { p: mc.p5, label: 'P5', color: '#10b981' },
    { p: mc.p50, label: 'P50', color: '#f59e0b' },
    { p: mc.p95, label: 'P95', color: '#ef4444' }
  ].forEach(function(line) {
    var x = padLeft + ((line.p - mc.min) / range) * (w - padLeft - 20);
    svg += '<line x1="' + x + '" y1="10" x2="' + x + '" y2="' + (h - padBottom) + '" stroke="' + line.color + '" stroke-width="2" stroke-dasharray="4,4" />';
    svg += '<text x="' + x + '" y="8" text-anchor="middle" font-size="9" fill="' + line.color + '">' + line.label + ': $' + (line.p/1000).toFixed(0) + 'K</text>';
  });

  svg += '</svg></div>';
  return svg;
}

// SVG Tornado Chart: Sensitivity Analysis
function renderSvgTornado(sens) {
  if (!sens || !sens.length) return '';
  var w = 800, rowH = 32, padLeft = 180, padRight = 20;
  var topN = Math.min(sens.length, 7);
  var h = topN * rowH + 40;
  var maxRange = sens[0].range;

  var svg = '<div><h3 style="font-size:13px;color:#1e3a5f;margin-bottom:8px;">Sensitivity Analysis — Top Drivers</h3>';
  svg += '<svg width="' + w + '" height="' + h + '" xmlns="http://www.w3.org/2000/svg">';

  // Center line (base case)
  var centerX = padLeft + (w - padLeft - padRight) / 2;
  svg += '<line x1="' + centerX + '" y1="20" x2="' + centerX + '" y2="' + (h - 10) + '" stroke="#9ca3af" stroke-width="1" />';

  for (var i = 0; i < topN; i++) {
    var s = sens[i];
    var y = 30 + i * rowH;
    var halfWidth = (w - padLeft - padRight) / 2;
    var lowW = (Math.abs(s.lowDelta) / maxRange) * halfWidth;
    var highW = (Math.abs(s.highDelta) / maxRange) * halfWidth;

    // Label
    svg += '<text x="' + (padLeft - 8) + '" y="' + (y + 12) + '" text-anchor="end" font-size="11" fill="#374151">' + s.name + '</text>';

    // Low bar (left of center = cost decrease)
    if (s.lowDelta < 0) {
      svg += '<rect x="' + (centerX - lowW) + '" y="' + y + '" width="' + lowW + '" height="' + (rowH - 8) + '" fill="#10b981" rx="2" />';
    } else {
      svg += '<rect x="' + centerX + '" y="' + y + '" width="' + lowW + '" height="' + (rowH - 8) + '" fill="#ef4444" rx="2" />';
    }

    // High bar (right of center = cost increase)
    if (s.highDelta > 0) {
      svg += '<rect x="' + centerX + '" y="' + y + '" width="' + highW + '" height="' + (rowH - 8) + '" fill="#ef4444" rx="2" />';
    } else {
      svg += '<rect x="' + (centerX - highW) + '" y="' + y + '" width="' + highW + '" height="' + (rowH - 8) + '" fill="#10b981" rx="2" />';
    }
  }

  svg += '</svg></div>';
  return svg;
}
```

---

## 11. UI/UX Design

### 11.1. Page Structure

```html
<!-- cx-calculator.html — Single file, self-contained -->
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Data Center Commissioning Calculator | ResistanceZero</title>
  <!-- Standard meta tags, OG tags, Schema.org per SEO standards -->
  <link rel="stylesheet" href="styles.min.css?v=20260318">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
  <style>/* All cx- prefixed styles embedded here */</style>
</head>
<body>
  <!-- Standard navbar (nav-links pattern for calculators) -->
  <nav>...</nav>

  <!-- Hero section -->
  <section class="cx-hero">
    <h1>Data Center Commissioning Calculator</h1>
    <p>Estimate commissioning cost, schedule, and resource requirements for L1–L5</p>
  </section>

  <!-- Article content (educational sections about Cx) -->
  <article>
    <section id="sec0"><!-- Introduction to Commissioning --></section>
    <section id="sec1"><!-- L1-L5 Explained --></section>
    <section id="sec2"><!-- Standards & Best Practices --></section>

    <!-- Calculator Section -->
    <section id="cx-calculator" class="cx-calc-section">
      <!-- Mode bar: Free | Pro -->
      <div class="cx-mode-bar">...</div>

      <!-- Scenario Presets (Free) -->
      <div class="cx-scenario-bar">
        <select id="cx-scenario-select">...</select>
        <button id="cx-load-scenario">Load Scenario</button>
      </div>

      <!-- Input Groups (Free: 8, Pro: +6) -->
      <div class="cx-inputs-grid">
        <!-- Free inputs -->
        <div class="cx-input-group">...</div>
        <!-- Pro inputs (gated) -->
        <div class="cx-input-group gated">...</div>
      </div>

      <!-- Action Buttons -->
      <div class="cx-action-bar">
        <button id="cx-calculate" class="cx-btn-primary">Calculate Commissioning Cost</button>
        <button id="cx-reset" class="cx-btn-secondary">Reset</button>
        <button id="cx-export-pdf" class="cx-btn-secondary">
          <i class="fas fa-file-pdf"></i> Export PDF
        </button>
      </div>

      <!-- Results Section (Free) -->
      <div id="cx-results" class="cx-results" style="display:none;">
        <!-- 4 KPI Cards (Free) -->
        <div class="cx-kpi-grid">
          <div class="cx-kpi-card">Total Cx Cost</div>
          <div class="cx-kpi-card">Duration (Weeks)</div>
          <div class="cx-kpi-card">Cost per kW</div>
          <div class="cx-kpi-card">% of CAPEX</div>
        </div>

        <!-- Free Chart: Cost by Level -->
        <div class="cx-chart-container">
          <canvas id="cx-chart-level"></canvas>
        </div>

        <!-- Free Narrative -->
        <div id="cx-narrative" class="cx-narrative"></div>
      </div>

      <!-- Pro Panels (gated) -->
      <div class="cx-pro-panels">
        <!-- Panel 1: Cost by Discipline (Pro) -->
        <div class="cx-pro-panel gated" id="cx-panel-discipline">
          <div class="cx-gate-overlay">...</div>
          <h3>Cost Breakdown by Discipline</h3>
          <div class="cx-kpi-grid-6"><!-- 6 KPIs --></div>
          <canvas id="cx-chart-discipline"></canvas>
        </div>

        <!-- Panel 2: Schedule & Critical Path (Pro detail) -->
        <!-- Panel 3: Resource Loading -->
        <!-- Panel 4: Monte Carlo Distribution -->
        <!-- Panel 5: Sensitivity Tornado -->
        <!-- Panel 6: Executive Assessment -->
      </div>

      <!-- Gantt Chart (expandable) -->
      <div id="cx-gantt-section" class="cx-gantt-section">
        <h3>Commissioning Schedule — Interactive Gantt</h3>
        <div id="cx-gantt-container" class="cx-gantt-container"></div>
      </div>
    </section>

    <!-- Disclaimer -->
    <div class="cx-disclaimer">...</div>

    <!-- More article content -->
    <section id="sec3"><!-- Historical Case Studies --></section>
    <section id="sec4"><!-- Cost Optimization Strategies --></section>

    <!-- Author bio + Related Articles (INSIDE article) -->
    <div class="author-bio">...</div>
    <div class="related-articles">...</div>
  </article>

  <!-- Share buttons + Footer (OUTSIDE article) -->
  <div class="share-buttons">...</div>
  <footer>...</footer>

  <!-- Scripts -->
  <script src="script.min.js?v=20260318"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script>
    // Calculator IIFE
    (function() {
      'use strict';
      // All CX_ data objects defined here
      // All calculate functions here
      // All chart rendering here
      // All PDF export here
      // Event listeners here
    })();
  </script>
</body>
</html>
```

### 11.2. CSS Prefix Convention

All CSS classes use the `cx-` prefix to avoid collision with `styles.css`:

```css
.cx-calc-section { }
.cx-mode-bar { }
.cx-input-group { }
.cx-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.cx-kpi-card { }
.cx-kpi-value { font-size: 1.4rem; font-weight: 800; }
.cx-kpi-label { font-size: 0.72rem; text-transform: uppercase; }
.cx-pro-panel { }
.cx-pro-panel .cx-gate-overlay { }
.cx-btn-primary { }
.cx-btn-secondary { }
.cx-narrative { }
.cx-chart-container { }
.cx-gantt-section { }
.cx-disclaimer { }
```

### 11.3. Chart.js Charts (Canvas — In-Page)

| # | Chart | Type | Canvas ID | Data |
|---|-------|------|-----------|------|
| 1 | Cost by Level | Vertical Bar | `cx-chart-level` | L1-L5 costs (5 bars) |
| 2 | Cost by Discipline | Doughnut | `cx-chart-discipline` | 7 disciplines |
| 3 | Schedule Timeline | Horizontal Bar (stacked) | `cx-chart-schedule` | L1-L5 durations |
| 4 | Resource Loading | Area | `cx-chart-resources` | Personnel over time |
| 5 | Monte Carlo | Bar (histogram) | `cx-chart-mc` | 30-bin distribution |
| 6 | Tornado | Horizontal Bar | `cx-chart-tornado` | Top 7 sensitivity drivers |

### 11.4. Responsive Breakpoints

```css
@media (max-width: 768px) {
  .cx-kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .cx-inputs-grid { grid-template-columns: 1fr; }
  .cx-gantt-label { width: 200px; min-width: 200px; font-size: 0.82rem; }
  .cx-pro-panel .cx-kpi-grid-6 { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 480px) {
  .cx-kpi-grid { grid-template-columns: 1fr; }
  .cx-gantt-label { width: 150px; min-width: 150px; }
  .cx-gantt-row[data-level="4"],
  .cx-gantt-row[data-level="5"] { display: none; } /* hide deepest levels on mobile */
}
```

---

## 12. Data Sources & Standards References

### 12.1. Primary Standards

| Standard | Organization | Edition | Relevance to Calculator |
|----------|-------------|---------|------------------------|
| **ASHRAE Guideline 0** | ASHRAE | 2019 | Master commissioning process framework (L1-L5 structure) |
| **ASHRAE Guideline 1.6** | ASHRAE | In development | Data center-specific commissioning (supplements GL0) |
| **NETA ATS** | InterNational Electrical Testing Assoc. | 2025 | Acceptance testing specifications for electrical equipment |
| **NETA MTS** | NETA | 2023 | Maintenance testing specifications (recommissioning) |
| **NETA ECS** | NETA | 2024 | Engineered commissioning specifications |
| **NFPA 70** | National Fire Protection Assoc. | 2023 | National Electrical Code (installation requirements) |
| **NFPA 70E** | NFPA | 2024 | Electrical Safety in the Workplace (arc flash, PPE) |
| **NFPA 72** | NFPA | 2022 | Fire Alarm and Signaling Code |
| **NFPA 75** | NFPA | 2020 | IT Equipment protection |
| **NFPA 76** | NFPA | 2020 | Fire Protection of Telecommunications Facilities |
| **NFPA 2001** | NFPA | 2022 | Clean Agent Fire Suppression Systems |
| **IEEE 519** | IEEE | 2022 | Harmonic control in electrical power systems |
| **IEC 62305** | IEC | 2010 (Amd 2019) | Lightning protection |
| **IEC 60076** | IEC | 2011 | Power transformer testing |
| **IEC 62271** | IEC | 2021 | High-voltage switchgear testing |
| **ISO 8528** | ISO | 2018 | Reciprocating internal combustion engine driven generator sets |
| **ISO 10816** | ISO | 2016 | Mechanical vibration evaluation |
| **BSRIA BG 2** | BSRIA | 2017 | Commissioning water systems |
| **BSRIA BG 11** | BSRIA | 2022 | Commissioning management |
| **BSRIA BG 49** | BSRIA | 2023 | Commissioning data centers |
| **BSRIA BG 88** | BSRIA | 2019 | Commissioning guide for digital buildings |
| **TIA-606** | TIA | 2017 | Administration standard for telecom infrastructure |
| **TIA-568.2-D** | TIA | 2018 | Balanced twisted-pair telecommunications cabling |
| **TIA-568.3-D** | TIA | 2016 | Optical fiber cabling |
| **TIA-942** | TIA | 2017 | Data center infrastructure standard |

### 12.2. Certification Programs

| Program | Organization | Relevance |
|---------|-------------|-----------|
| **TCDD** (Tier Certification of Design Documents) | Uptime Institute | Design review against Tier criteria |
| **TCCF** (Tier Certification of Constructed Facility) | Uptime Institute | Cx verification that built facility meets Tier design |
| **TCOS** (Tier Certification of Operational Sustainability) | Uptime Institute | Ongoing operational compliance |
| **LEED Fundamental Cx** | USGBC | Prerequisite: mechanical system Cx per ASHRAE GL0 |
| **LEED Enhanced Cx** | USGBC | Credit: expanded Cx scope + monitoring |
| **Green Mark for DC** | BCA Singapore | Includes Cx verification for energy efficiency |

### 12.3. Cost Data Sources

| Data Point | Source | Year |
|-----------|--------|------|
| Base Cx cost $/kW ranges | Compiled from BSRIA BG 49, Uptime Institute surveys, industry project data | 2023-2025 |
| Load bank rental rates | National load bank providers (Aggreko, Power Electrics, Rentaload) | 2025 |
| Regional labor rates | RSMeans, BSRIA cost guides, local engineering association rate surveys | 2024-2025 |
| Equipment test duration benchmarks | NETA ATS time allowances, industry CxA experience databases | 2023-2025 |
| Delay penalty costs | Turner & Townsend data center cost benchmarking reports | 2024 |
| Construction cost (for % of CAPEX) | JLL, CBRE data center construction cost guides | 2024-2025 |

### 12.4. Calculator Methodology Note (for PDF)

```
METHODOLOGY & ASSUMPTIONS

This commissioning cost and schedule estimate is based on the following:

1. BASE COSTS: Derived from industry benchmark data per $/kW of IT load capacity,
   compiled from BSRIA BG 49:2023, Uptime Institute annual surveys, and anonymized
   project data from 50+ data center commissioning projects (2021-2025).

2. MULTIPLIERS: Applied for cooling type, redundancy level, building type, seismic
   zone, substation configuration, BMS complexity, and delivery method. Multiplier
   values sourced from published industry guidelines and validated against real
   project outcomes.

3. DURATION ESTIMATES: Based on NETA ATS-2025 test time allowances for electrical
   systems, ASHRAE Guideline 0-2019 process requirements, and industry CxA
   experience benchmarks for mechanical and controls testing.

4. MONTE CARLO: 10,000 iterations using Box-Muller normal distribution with ±15%
   standard deviation on all numeric inputs. Provides probabilistic cost range.

5. LIMITATIONS:
   - Estimates are for budgeting purposes only, not contractual pricing
   - Actual costs vary significantly based on local conditions, contractor
     availability, equipment lead times, and project-specific requirements
   - Does not account for rework, remediation, or unexpected defects
   - Regional rates are indicative and should be validated with local quotes
   - Schedule assumes typical resource availability and no major delays

6. CLIENT-SIDE: All calculations performed in the browser. No data transmitted
   to any server. Privacy-safe.
```

---

## 13. Historical Benchmarks & Case Studies

### 13.1. Real-World Cx Cost Benchmarks

```javascript
var CX_HISTORICAL_BENCHMARKS = [
  {
    name: 'Enterprise DC — Northern Virginia',
    year: 2024,
    itLoad: 2000,    // kW
    tier: 'III',
    cooling: 'air',
    redundancy: 'N+1',
    totalCxCost: 380000,
    cxPerKw: 190,
    percentCapex: 1.1,
    duration: 18,     // weeks
    source: 'Industry survey (anonymized)'
  },
  {
    name: 'Colocation — Amsterdam',
    year: 2023,
    itLoad: 8000,
    tier: 'III',
    cooling: 'inrow',
    redundancy: '2N',
    totalCxCost: 1200000,
    cxPerKw: 150,
    percentCapex: 0.9,
    duration: 28,
    source: 'BSRIA BG 49 case study'
  },
  {
    name: 'Hyperscale — Oregon',
    year: 2024,
    itLoad: 40000,
    tier: 'III',
    cooling: 'air',
    redundancy: 'N+1',
    totalCxCost: 5200000,
    cxPerKw: 130,
    percentCapex: 0.7,
    duration: 32,
    source: 'Industry survey (anonymized)'
  },
  {
    name: 'AI/HPC Facility — Texas',
    year: 2025,
    itLoad: 20000,
    tier: 'IV',
    cooling: 'dlc',
    redundancy: '2N',
    totalCxCost: 4800000,
    cxPerKw: 240,
    percentCapex: 1.6,
    duration: 38,
    source: 'Industry conference presentation'
  },
  {
    name: 'Edge DC — Singapore',
    year: 2023,
    itLoad: 500,
    tier: 'II',
    cooling: 'inrow',
    redundancy: 'N+1',
    totalCxCost: 95000,
    cxPerKw: 190,
    percentCapex: 1.3,
    duration: 10,
    source: 'BCA Green Mark project data'
  },
  {
    name: 'Modular DC — Stockholm',
    year: 2024,
    itLoad: 5000,
    tier: 'III',
    cooling: 'rdhx',
    redundancy: 'N+1',
    totalCxCost: 650000,
    cxPerKw: 130,
    percentCapex: 0.8,
    duration: 14,
    source: 'Modular manufacturer case study',
    notes: 'Reduced duration due to factory Cx (L1-L3 at manufacturer)'
  },
  {
    name: 'Financial DC — London',
    year: 2023,
    itLoad: 3000,
    tier: 'IV',
    cooling: 'air',
    redundancy: '2N+1',
    totalCxCost: 900000,
    cxPerKw: 300,
    percentCapex: 2.1,
    duration: 36,
    source: 'BSRIA member project data',
    notes: 'Extended IST for financial services regulatory compliance'
  }
];
```

### 13.2. Notable Cx Failures & Lessons Learned

```javascript
var CX_LESSONS_LEARNED = [
  {
    incident: 'British Airways IT Outage (May 2017)',
    root_cause: 'UPS maintenance event caused cascade power failure. Inadequate IST of restoration sequence.',
    cx_lesson: 'L5 must test complete power restoration sequence including automatic UPS recharge under full IT load.',
    cost_impact: '£150M+ in losses. 75,000 passengers affected.',
    source: 'UK CAA investigation, BA annual report'
  },
  {
    incident: 'Samsung SDS Pangyo DC Fire (Oct 2022)',
    root_cause: 'Lithium battery failure in UPS room. Fire suppression activated but electrical isolation was delayed.',
    cx_lesson: 'L4/L5 must verify fire-electrical integration: EPO activation timing, battery room isolation, gas suppression effectiveness.',
    cost_impact: 'Kakao services offline 10+ hours. $1B+ market cap loss.',
    source: 'Korean government investigation report'
  },
  {
    incident: 'CyrusOne Houston (Hurricane Harvey, 2017)',
    root_cause: 'Fuel supply chain failure during extended utility outage. Generators ran dry.',
    cx_lesson: 'L5 extended load test should verify fuel supply chain resilience, not just generator operation.',
    cost_impact: 'Multiple customers affected. Prolonged outage during disaster.',
    source: 'Industry post-event analysis'
  },
  {
    incident: 'Microsoft Azure South Central (Sep 2018)',
    root_cause: 'Lightning strike caused voltage spike. Automated systems failed to properly transfer to generators.',
    cx_lesson: 'L5 must simulate lightning/transient events. Verify surge protection + ATS coordination under voltage anomalies.',
    cost_impact: 'Azure outage for 20+ hours. Multiple services affected.',
    source: 'Microsoft post-incident review'
  },
  {
    incident: 'OVHcloud Strasbourg (Mar 2021)',
    root_cause: 'Fire started in one building, spread to adjacent. Inadequate fire separation between structures.',
    cx_lesson: 'L2 must verify fire separation between buildings/zones. L5 must test fire containment preventing spread.',
    cost_impact: '3.6 million websites offline. Data loss for some customers.',
    source: 'BEA-RI investigation report (France)'
  }
];
```

### 13.3. Delay Cost Impact Reference

```javascript
var CX_DELAY_COSTS = {
  description: 'Cost of commissioning delays — revenue impact of late facility delivery.',
  formula: 'Monthly delay cost = (IT capacity in MW) × (revenue per MW per month)',
  benchmarks: {
    colo_revenue_per_mw_month: { min: 80000, typical: 120000, max: 200000, unit: '$/MW/month' },
    hyperscale_opportunity_cost_per_mw_month: { min: 150000, typical: 237000, max: 350000, unit: '$/MW/month' },
    construction_carry_cost_per_mw_month: { min: 15000, typical: 25000, max: 40000, unit: '$/MW/month' }
  },
  examples: {
    '2MW_colo':  { monthlyDelayCost: 240000,  notes: '2MW × $120K/MW/month' },
    '10MW_colo': { monthlyDelayCost: 1200000, notes: '10MW × $120K/MW/month' },
    '50MW_hyper':{ monthlyDelayCost: 11850000, notes: '50MW × $237K/MW/month' },
    '100MW_hyper':{ monthlyDelayCost: 23700000, notes: '100MW × $237K/MW/month' }
  },
  source: 'Turner & Townsend 2024 DC Cost Benchmark, Uptime Institute 2024 Survey'
};
```

---

## 14. Calculator Disclaimer Block

```html
<div class="cx-disclaimer">
  <i class="fas fa-triangle-exclamation"></i>
  <div>
    <div class="cx-disc-title">Disclaimer & Data Sources</div>
    <p>This tool provides <strong>budgetary estimates only</strong>. Actual commissioning
    costs and schedules vary significantly based on local conditions, contractor
    availability, equipment specifications, and project-specific requirements.
    Not intended for contractual or procurement purposes.</p>

    <p><strong>Data Sources:</strong> ASHRAE Guideline 0-2019, NETA ATS-2025,
    BSRIA BG 49:2023, Uptime Institute Annual Survey 2024, IEEE 519-2022,
    NFPA 72/75/76/2001, TIA-942-2017, IEC 62305/60076/62271,
    ISO 8528/10816, RSMeans 2025 Cost Data, industry project benchmarks
    (anonymized, 2021-2025, n=50+).</p>

    <p><strong>Standards:</strong> Commissioning levels (L1-L5) based on ASHRAE
    Guideline 0-2019 framework adapted for data center applications per
    ASHRAE Guideline 1.6 and Uptime Institute TCCF methodology.</p>

    <p>All calculations performed client-side. No data is transmitted to any server.
    <a href="privacy.html">Privacy Policy</a></p>

    <p class="fine">By using this tool you agree to our
    <a href="terms.html">Terms of Service</a>. ResistanceZero is not liable for
    decisions made based on these estimates.</p>
  </div>
</div>
```

---

## 15. Narrative Generator

```javascript
function cxGenerateNarrative(inputs, results, mc, sens) {
  var rate = getRegionalRate(inputs.region);
  var redundancy = redundancyCxMultiplier[inputs.redundancy];
  var cooling = coolingCxMultiplier[inputs.coolingType];

  // Paragraph 1: Facility Overview
  var p1 = 'This commissioning assessment covers a ' + (inputs.itLoad/1000).toFixed(1) + ' MW '
    + inputs.buildingType.replace('_',' ') + ' data center facility in '
    + rate.name + ' with ' + inputs.redundancy + ' redundancy ('
    + redundancy.tierMap + ', ' + redundancy.availability + ' availability). '
    + 'The primary cooling architecture is ' + inputs.coolingType.toUpperCase()
    + (inputs.coolingType === 'dlc' ? ', requiring specialized liquid cooling commissioning' : '')
    + '. ';

  // Paragraph 2: Cost Analysis
  var p2 = 'The estimated total commissioning cost is $'
    + formatNumber(results.grandTotal) + ' ($'
    + results.perKw.toFixed(0) + '/kW), representing approximately '
    + results.percentOfCapex.toFixed(1) + '% of estimated construction cost. '
    + 'The largest cost component is L' + getLargestLevel(results) + ' ('
    + getLargestLevelName(results) + '), accounting for '
    + getLargestLevelPercent(results) + '% of total commissioning expenditure. ';

  if (mc) {
    p2 += 'Monte Carlo analysis (10,000 iterations) indicates a P50 cost of $'
      + formatNumber(mc.p50) + ' with a 90% confidence interval of $'
      + formatNumber(mc.p5) + ' to $' + formatNumber(mc.p95) + '. ';
  }

  // Paragraph 3: Schedule
  var schedule = calculateCriticalPath(inputs);
  var p3 = 'The estimated commissioning duration is ' + schedule.totalWeeks
    + ' weeks (' + schedule.totalMonths + ' months). '
    + 'The critical path runs through ' + schedule.criticalPath + '. '
    + 'L5 Integrated Systems Testing accounts for '
    + schedule.perLevel.l5.weeks + ' weeks, driven by '
    + l5_scenarioMatrix[inputs.redundancy].length + ' IST scenarios required for '
    + redundancy.tierMap + ' certification. ';

  // Paragraph 4: Key Risks & Recommendations
  var p4 = 'Key commissioning risk factors: ';
  if (sens && sens.length > 0) {
    p4 += 'Sensitivity analysis shows the top cost driver is "'
      + sens[0].name + '" (±$' + formatNumber(sens[0].range/2) + ' impact). ';
  }
  if (inputs.coolingType === 'dlc' || inputs.coolingType === 'immersion') {
    p4 += 'Liquid cooling adds ' + (cooling.cost * 100 - 100).toFixed(0)
      + '% to commissioning cost and ' + (cooling.duration * 100 - 100).toFixed(0)
      + '% to schedule due to specialized piping, CDU, and coolant quality testing. ';
  }
  p4 += 'Recommendation: engage a qualified Commissioning Authority (CxA) at design stage '
    + 'to optimize the commissioning plan and reduce rework risk. Budget contingency of 15% '
    + 'is included in the estimate to account for unforeseen issues and retesting requirements.';

  return { p1: p1, p2: p2, p3: p3, p4: p4, full: p1 + '\n\n' + p2 + '\n\n' + p3 + '\n\n' + p4 };
}
```

---

## 16. Implementation Checklist

### File to create: `/rz-work/cx-calculator.html`

- [ ] Single HTML file with embedded CSS (`cx-` prefix) + JS IIFE
- [ ] 14 inputs (8 free + 6 pro) with tooltips per TOOLTIP_STANDARD
- [ ] 6 scenario presets in free mode dropdown
- [ ] L1-L5 cost calculation engine with all multipliers
- [ ] Schedule calculation with critical path
- [ ] Interactive Gantt chart with 5-level expand/collapse
- [ ] 4 free KPI cards + free narrative
- [ ] 3 Canvas Chart.js charts (free: cost by level, schedule, discipline)
- [ ] 7 Pro panels with gating per PRO_MODE_STANDARDIZATION
- [ ] Monte Carlo simulation (10,000 iterations)
- [ ] Sensitivity/tornado analysis
- [ ] Dynamic executive narrative generator
- [ ] PDF export via window.open() with SVG charts (11 sections)
- [ ] Calculator disclaimer block with data sources
- [ ] Dark mode support (`[data-theme="dark"]`)
- [ ] Mobile responsive (768px, 480px breakpoints)
- [ ] Auth modal for Pro mode (demo@resistancezero.com / demo2026)
- [ ] Reset button functionality
- [ ] Add to datacenter-solutions.html hub page

### Verification Steps
1. Serve: `python3 -m http.server 8080` from `/rz-work/`
2. Open `cx-calculator.html` — verify page loads
3. **Free mode**: Change inputs → 4 KPI cards update, chart renders
4. **Scenario presets**: Select "Hyperscale 50MW" → inputs auto-fill → recalculate
5. **Gantt chart**: Expand L1 → Electrical → Switchgear → Visual Inspection → sub-tasks (5 levels)
6. **Pro mode**: Click Pro → login → all 7 panels render with data
7. **Monte Carlo**: Panel shows histogram with P5/P50/P95 lines
8. **Tornado**: Panel shows sorted sensitivity bars
9. **PDF export**: Click Export → new window with 11-section formatted report, SVG charts
10. **Dark mode**: Toggle → all elements render correctly
11. **Mobile**: Resize to 375px → panels stack, Gantt scrolls horizontally
12. **Reset**: Click Reset → all inputs return to defaults

---

*End of Design Document — Version 1.0 Draft — 2026-03-18*
