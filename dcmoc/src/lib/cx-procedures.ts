/* ─── Cx PROCEDURES — test-procedure templates + readiness checklist ─────────
 * Ported FAITHFULLY from DC Hub cx-calculator.html (CX_PROC_TEMPLATES +
 * CX_ACTIVITY_MAP): NETA / IEEE / ASHRAE / NFPA-referenced procedure text,
 * acceptance criteria, tools, safety and witness levels are verbatim; the
 * logsheet is reduced to its field labels. resolveProc() replicates
 * cxGetProcedure() {placeholder} substitution exactly (missing param → key
 * name). CX_CHECKLIST maps every engine readiness key (L1..L5, ist, sat,
 * fat, punchlist) to real template + real activity-map parameter sets — no
 * fabricated activities.
 * ──────────────────────────────────────────────────────────────────────── */

export type CxWitness = 'H' | 'W' | 'R';

export interface CxAcceptance {
    criteria: string;
    standard: string;
    justification: string;
}

export interface CxProcTemplate {
    title: string;
    procedure: string[];
    acceptance: CxAcceptance;
    /** logsheet field labels (source `f` keys; input types dropped). */
    logsheet: string[];
    tools: string[];
    safety: string[];
    /** H = hold point, W = witness, R = review. */
    witness: CxWitness;
    duration_note: string;
}

export type CxTemplateKey =
    | 'ir_test' | 'ct_ratio_test' | 'relay_test' | 'breaker_test' | 'transformer_test'
    | 'cable_test' | 'ups_test' | 'generator_load_bank' | 'chiller_startup' | 'dlc_startup'
    | 'flow_balance' | 'airflow_balance' | 'vfd_test' | 'functional_sequence' | 'ist_scenario'
    | 'doc_review' | 'training' | 'closeout' | 'visual_inspection' | 'pressure_test';

export const CX_PROC_TEMPLATES: Record<CxTemplateKey, CxProcTemplate> = {
    ir_test: {
        "title": "Insulation Resistance (Megger) Test",
        "procedure": [
            "De-energize and apply LOTO per site procedure",
            "Disconnect SPDs, VFDs, electronic equipment from circuit under test",
            "Verify zero energy state with voltage tester (live-dead-live)",
            "Connect megger leads per test matrix: L1-L2, L1-L3, L2-L3, L1-G, L2-G, L3-G",
            "Apply test voltage per NETA Table 100.1 for {voltage_class} equipment",
            "Record 1-minute insulation resistance value (MΩ) for each combination",
            "For PI measurement: continue test to 10 minutes, record value, calculate ratio",
            "Compare results against minimum acceptance: {min_ir}",
            "Temperature-correct readings to 20°C using IEEE 43 correction factors",
            "Reconnect all disconnected devices and remove LOTO",
            "Document all results, ambient conditions, and instrument details in logsheet"
        ],
        "acceptance": {
            "criteria": "Insulation resistance ≥ {min_ir} at {test_voltage}. Polarization Index ≥ 2.0 (rotating machines), ≥ 1.0 (transformers per IEEE C57.12)",
            "standard": "NETA ATS-2025 §7.3.1, IEEE 43-2013, IEEE C57.12.90",
            "justification": "IR confirms absence of moisture ingress, contamination, or insulation degradation. PI indicates whether insulation absorption characteristics are healthy. Values below threshold indicate compromised insulation requiring investigation before energization."
        },
        "logsheet": [
            "Equipment Tag/ID",
            "Location",
            "Test Date",
            "Ambient Temp (°C)",
            "Relative Humidity (%)",
            "Megger Make/Model",
            "Megger Serial No.",
            "Calibration Due Date",
            "Applied Test Voltage (V)",
            "L1-L2 (MΩ)",
            "L1-L3 (MΩ)",
            "L2-L3 (MΩ)",
            "L1-G (MΩ)",
            "L2-G (MΩ)",
            "L3-G (MΩ)",
            "1-min IR (MΩ)",
            "10-min IR (MΩ)",
            "PI Ratio (10min/1min)",
            "Temp Corrected to 20°C (MΩ)",
            "Pass / Fail",
            "Tested By (print name)",
            "Signature",
            "Witnessed By",
            "Witness Signature",
            "Remarks / Observations"
        ],
        "tools": [
            "Megger insulation tester (calibrated, NIST traceable)",
            "Ambient temperature & humidity meter",
            "Voltage tester (CAT IV rated)",
            "PPE: Class 0 insulated gloves, safety glasses, arc-rated clothing"
        ],
        "safety": [
            "LOTO required — verify zero energy state",
            "Residual charge: wait minimum 4× time constant before contact",
            "Arc flash boundary: maintain safe working distance per NFPA 70E",
            "Minimum 2 persons for HV testing"
        ],
        "witness": "H",
        "duration_note": "Allow 30–60 min per circuit including setup and documentation"
    },
    ct_ratio_test: {
        "title": "Current Transformer Ratio & Polarity Verification",
        "procedure": [
            "Isolate CT circuits — never open-circuit an energized CT",
            "Inject known primary current using CT test set",
            "Measure secondary current on all CT taps",
            "Calculate ratio: Primary I ÷ Secondary I",
            "Compare measured ratio to nameplate ±0.5% for metering, ±3% for protection",
            "Verify polarity marking using DC kick test or phase angle measurement",
            "Measure CT burden at rated current",
            "Document ratio error percentage for each tap position"
        ],
        "acceptance": {
            "criteria": "Ratio deviation ≤ {ratio_tolerance} of nameplate. Polarity correct. Burden within rated VA.",
            "standard": "NETA ATS-2025 §7.3.2, IEEE C57.13, IEC 61869-2",
            "justification": "Incorrect CT ratio causes metering errors and protection misoperation. Reversed polarity causes differential relay false trips. Testing at factory ensures CTs meet specification before installation."
        },
        "logsheet": [
            "CT Tag/ID",
            "Manufacturer/Model",
            "Nameplate Ratio",
            "Class/Accuracy",
            "Rated Burden (VA)",
            "Test Date",
            "Injected Primary I (A)",
            "Measured Secondary I (A)",
            "Calculated Ratio",
            "Ratio Error (%)",
            "Polarity (Correct/Reversed)",
            "Measured Burden (VA)",
            "Accept / Reject",
            "Tested By",
            "Witnessed By",
            "Remarks"
        ],
        "tools": [
            "CT ratio test set (calibrated)",
            "Ammeter (0.5% accuracy minimum)",
            "Phase angle meter",
            "Burden measurement kit"
        ],
        "safety": [
            "NEVER open-circuit an energized CT — lethal voltages develop",
            "Verify CT secondary circuit is shorted or connected to burden before primary energization",
            "Use insulated tools only"
        ],
        "witness": "H",
        "duration_note": "Allow 15–20 min per CT including all taps"
    },
    relay_test: {
        "title": "Protection Relay Functional Test",
        "procedure": [
            "Isolate relay from tripping circuit (block trip outputs)",
            "Connect relay test set to relay current/voltage inputs",
            "Inject fault current at {pickup_value} — verify pickup",
            "Measure pickup threshold: increase current until relay operates",
            "Verify dropout at {dropout_pct}% of pickup setting",
            "Test time-overcurrent curve at 3+ points: 2×, 5×, 10× pickup",
            "Verify coordination margins with upstream/downstream devices",
            "Test instantaneous element at setting ±5%",
            "Verify trip contact closure and auxiliary outputs",
            "Restore relay to service — remove blocks, verify alarms clear"
        ],
        "acceptance": {
            "criteria": "Pickup within ±{pickup_tolerance}% of setting. Time-overcurrent curve within ±{time_tolerance}% or ±{time_ms}ms (whichever is greater). Coordination margins maintained.",
            "standard": "NETA ATS-2025 §7.9, IEEE C37.90, IEC 60255",
            "justification": "Protection relays are the last line of defense against equipment damage and personnel safety hazards. Testing confirms correct settings, coordination with other devices, and reliable operation under fault conditions."
        },
        "logsheet": [
            "Relay Tag/ID",
            "Manufacturer/Model",
            "Firmware Version",
            "Function Tested",
            "Setting Value",
            "Test Date",
            "Relay Test Set Model",
            "Pickup Current/Voltage",
            "Measured Pickup",
            "Pickup Error (%)",
            "Dropout Value",
            "Time at 2× Pickup (ms)",
            "Time at 5× Pickup (ms)",
            "Time at 10× Pickup (ms)",
            "Expected Time (ms)",
            "Time Error (%)",
            "Trip Output Verified",
            "Pass / Fail",
            "Tested By",
            "Witnessed By",
            "Remarks"
        ],
        "tools": [
            "Relay test set (Omicron CMC / Doble F6150 or equivalent)",
            "Laptop with relay configuration software",
            "Timer (millisecond resolution)",
            "Multimeter for contact verification"
        ],
        "safety": [
            "Block trip outputs before testing to prevent inadvertent breaker operation",
            "Coordinate with operations — inform control room",
            "Maintain arc flash PPE when working on energized panels"
        ],
        "witness": "H",
        "duration_note": "Allow 2–4 hours per relay including all functions"
    },
    breaker_test: {
        "title": "Circuit Breaker Mechanical & Timing Test",
        "procedure": [
            "De-energize breaker and apply LOTO",
            "Verify stored energy mechanism is charged",
            "Perform close operation — record close time",
            "Perform open (trip) operation — record open time",
            "Perform close-open (CO) sequence — record both times",
            "Measure contact resistance across each phase using DLRO",
            "Compare all timing values against manufacturer specifications",
            "Verify trip-free mechanism: attempt close during trip signal",
            "Test auxiliary contacts: 52a, 52b state changes",
            "Cycle breaker {cycle_count} times and verify consistent operation",
            "Record spring charge motor current and time"
        ],
        "acceptance": {
            "criteria": "Close time ≤ {close_ms}ms. Open time ≤ {open_ms}ms. Contact resistance ≤ {cr_uohm}µΩ. CO time within manufacturer tolerance.",
            "standard": "NETA ATS-2025 §7.3.3, IEEE C37.09, IEC 62271-100",
            "justification": "Breaker timing directly affects fault clearing time and arc flash incident energy. High contact resistance indicates degradation and increases heating. Consistent mechanical operation confirms spring mechanism integrity."
        },
        "logsheet": [
            "Breaker Tag/ID",
            "Manufacturer/Model",
            "Voltage Rating",
            "Current Rating (A)",
            "Test Date",
            "Close Time Phase A (ms)",
            "Close Time Phase B (ms)",
            "Close Time Phase C (ms)",
            "Open Time Phase A (ms)",
            "Open Time Phase B (ms)",
            "Open Time Phase C (ms)",
            "CO Time (ms)",
            "Contact Res. Phase A (µΩ)",
            "Contact Res. Phase B (µΩ)",
            "Contact Res. Phase C (µΩ)",
            "DLRO Make/Model/SN",
            "Spring Charge Time (s)",
            "Trip-Free Test OK",
            "Pass / Fail",
            "Tested By",
            "Witnessed By",
            "Remarks"
        ],
        "tools": [
            "Breaker timing analyzer (calibrated)",
            "Digital Low Resistance Ohmmeter (DLRO/µΩ meter)",
            "High-current test set (for contact resistance)",
            "Stopwatch for spring charge time"
        ],
        "safety": [
            "LOTO required",
            "Stored energy: verify springs are discharged before internal access",
            "Stand clear of breaker mechanism during close/open operations",
            "Arc flash PPE required"
        ],
        "witness": "W",
        "duration_note": "Allow 1–2 hours per breaker"
    },
    transformer_test: {
        "title": "Power Transformer Acceptance Test",
        "procedure": [
            "Perform turns ratio test on all tap positions",
            "Measure winding resistance on all windings (hot & cold if applicable)",
            "Perform insulation resistance test (HV-LV, HV-G, LV-G)",
            "Collect oil sample for Dissolved Gas Analysis (DGA)",
            "Measure oil dielectric breakdown strength",
            "Measure oil moisture content (Karl Fischer method)",
            "Perform heat run test at rated load for {heat_run_hours} hours",
            "Measure impedance at rated frequency",
            "Test tap changer operation through all positions",
            "Perform partial discharge measurement at 1.3× rated voltage",
            "Verify cooling system operation (fans, pumps, radiators)"
        ],
        "acceptance": {
            "criteria": "Turns ratio within ±0.5% of nameplate. DGA: no combustible gases above normal. Oil moisture < 10ppm. Dielectric breakdown ≥ 30kV (per D1816). Temperature rise ≤ {temp_rise}°C above ambient.",
            "standard": "IEEE C57.12.90, IEEE C57.104 (DGA), IEC 60076, NETA ATS-2025 §7.3.4",
            "justification": "Transformer is single highest-value equipment in electrical distribution. Testing confirms design capacity, insulation integrity, and oil quality. DGA establishes baseline fingerprint for operational trending."
        },
        "logsheet": [
            "Transformer Tag/ID",
            "Manufacturer/Serial",
            "Rating (MVA)",
            "Voltage (HV/LV)",
            "Test Date",
            "Turns Ratio (all taps)",
            "Winding Resistance HV (mΩ)",
            "Winding Resistance LV (mΩ)",
            "IR HV-LV (MΩ)",
            "IR HV-G (MΩ)",
            "IR LV-G (MΩ)",
            "Oil DGA Results",
            "Oil Moisture (ppm)",
            "Oil Dielectric (kV)",
            "Heat Run Duration (hr)",
            "Top Oil Temp Rise (°C)",
            "Winding Temp Rise (°C)",
            "Impedance (%Z)",
            "PD Level (pC)",
            "Tap Changer — All Positions OK",
            "Pass / Fail",
            "Tested By",
            "Witnessed By",
            "Remarks"
        ],
        "tools": [
            "Turns ratio tester",
            "Winding resistance tester",
            "Insulation resistance tester (10kV)",
            "Oil sampling kit (syringes, bottles)",
            "DGA analysis lab",
            "Dielectric tester (D1816)",
            "Karl Fischer titrator",
            "Temperature data loggers",
            "Partial discharge detector"
        ],
        "safety": [
            "HV testing — minimum safe approach distance per NFPA 70E",
            "Oil handling: spill containment, fire extinguisher nearby",
            "Heat run: continuous monitoring, emergency shutdown procedure ready"
        ],
        "witness": "H",
        "duration_note": "Allow 2–5 days including heat run"
    },
    cable_test: {
        "title": "Cable Insulation & Continuity Test",
        "procedure": [
            "Identify cable under test and verify both ends disconnected",
            "Perform continuity test on all conductors end-to-end",
            "Verify conductor identification: phase colors/numbers match schedule",
            "Apply insulation test voltage per NETA Table 100.1",
            "Record insulation resistance for each conductor-to-conductor and conductor-to-shield",
            "Verify shield/screen continuity and grounding",
            "For fibre: perform OTDR test from both ends",
            "Record attenuation per ANSI/TIA-568 limits",
            "Document all test results with cable tag reference"
        ],
        "acceptance": {
            "criteria": "Continuity: all conductors pass end-to-end. IR ≥ {min_ir} per kV of rating. Fibre attenuation ≤ {max_att} dB/km. No crossed or reversed conductors.",
            "standard": "NETA ATS-2025 §7.3.1, ANSI/TIA-568, ANSI/TIA-942 (structured cabling)",
            "justification": "Cable testing before energization prevents damage from insulation faults, reversed phases, and cross-connections. OTDR testing of fibre establishes baseline for future fault location. This is mandatory before first energization."
        },
        "logsheet": [
            "Cable Tag/ID",
            "From (origin)",
            "To (destination)",
            "Cable Type/Size",
            "Voltage Rating",
            "Test Date",
            "Continuity L1/L2/L3/N/E",
            "IR L1-L2 (MΩ)",
            "IR L1-L3 (MΩ)",
            "IR L2-L3 (MΩ)",
            "IR L1-E (MΩ)",
            "IR L2-E (MΩ)",
            "IR L3-E (MΩ)",
            "Shield Continuity OK",
            "OTDR Attenuation (dB/km)",
            "Pass / Fail",
            "Tested By",
            "Witnessed By",
            "Remarks"
        ],
        "tools": [
            "Megger insulation tester",
            "Cable continuity tester",
            "OTDR (for fibre)",
            "Fluke DTX/DSX (for structured cabling)",
            "Cable identification tool"
        ],
        "safety": [
            "LOTO at both ends of cable before testing",
            "Verify cable is de-energized using voltage tester",
            "Wait for residual charge to dissipate on long HV cables"
        ],
        "witness": "W",
        "duration_note": "Allow 15–30 min per cable run"
    },
    ups_test: {
        "title": "UPS System Functional Test",
        "procedure": [
            "Verify UPS input, output, bypass voltages and frequency",
            "Apply rated load using load bank or IT simulation",
            "Measure output voltage regulation at 25%, 50%, 75%, 100% load",
            "Simulate input power loss — verify seamless transfer to battery",
            "Measure transfer time using power quality analyzer",
            "Monitor battery discharge: record voltage, current, and time",
            "Restore input power — verify retransfer to mains",
            "Test static bypass transfer (manual and automatic)",
            "Test maintenance bypass path: verify no break to output",
            "Test module removal under load (N+1 verification)",
            "Measure output harmonic distortion (THDv) at rated load",
            "Measure efficiency at 25%, 50%, 75%, 100% load"
        ],
        "acceptance": {
            "criteria": "Transfer time ≤ {transfer_ms}ms (IEC 62040-3 Class 1). Output THDv ≤ {thd_pct}% linear load. Efficiency ≥ {eff_pct}% at 50% load. Battery autonomy ≥ {autonomy_min} minutes.",
            "standard": "IEC 62040-3, NETA ATS-2025 §7.11, Uptime Institute Tier Requirements",
            "justification": "UPS is the critical bridge between utility/generator power. Transfer time determines whether IT load experiences disruption. Battery test confirms autonomy under real load. Module redundancy test proves N+1 architecture."
        },
        "logsheet": [
            "UPS Tag/ID",
            "Manufacturer/Model",
            "Rated kVA",
            "Battery Type/String",
            "Test Date",
            "Input Voltage (V)",
            "Output Voltage (V)",
            "Load Applied (kW)",
            "Load % of Rating",
            "Mains→Battery Transfer (ms)",
            "Battery→Mains Transfer (ms)",
            "Static Bypass Transfer (ms)",
            "Maint Bypass — Output OK",
            "Module Removal — Output OK",
            "THDv at Rated Load (%)",
            "Efficiency at 25% (%)",
            "Efficiency at 50% (%)",
            "Efficiency at 75% (%)",
            "Efficiency at 100% (%)",
            "Battery Autonomy (min)",
            "Battery End Voltage (V)",
            "Pass / Fail",
            "Tested By",
            "Witnessed By",
            "Remarks"
        ],
        "tools": [
            "Load bank or IT load simulator",
            "Power quality analyzer (capture transfer waveform)",
            "Battery monitoring system",
            "Thermal camera for connection verification",
            "Data logger (50ms minimum sample rate for transfer)"
        ],
        "safety": [
            "Battery room: hydrogen gas monitoring, no spark sources",
            "Arc flash PPE for UPS internal work",
            "Verify maintenance bypass before any module work",
            "Emergency shutdown procedure reviewed by all personnel"
        ],
        "witness": "H",
        "duration_note": "Allow 4–6 hours per UPS system"
    },
    generator_load_bank: {
        "title": "Generator Load Bank Test",
        "procedure": [
            "Verify all pre-start checks complete (oil, coolant, fuel, battery)",
            "Start engine — verify start time ≤ {start_time}s",
            "Stabilize at no-load: verify voltage ±2%, frequency ±0.5Hz",
            "Apply Step 1: {step1_pct}% load — hold {step1_min} min",
            "Record V, I, Hz, exhaust temp, coolant temp, oil pressure",
            "Apply Step 2: {step2_pct}% load — hold {step2_min} min",
            "Apply Step 3: {step3_pct}% load — hold {step3_min} min",
            "Apply Step 4: {step4_pct}% load — hold {step4_min} min",
            "Monitor all parameters continuously — flag any anomalies",
            "Perform load rejection test: {step4_pct}%→0% — record recovery time",
            "Perform ATS transfer test: simulate utility loss, verify transfer ≤ {ats_time}s",
            "Cool down at no-load for minimum {cooldown_min} min before shutdown"
        ],
        "acceptance": {
            "criteria": "Start time ≤ {start_time}s. Voltage stability ±2% at each step. Frequency ±0.5Hz. Exhaust temp ≤ {exhaust_max}°C. Coolant temp ≤ {coolant_max}°C. Oil pressure within OEM range. ATS transfer ≤ {ats_time}s per NFPA 110.",
            "standard": "NFPA 110-2022 §7.13, ISO 8528-1, NETA ATS-2025 §7.13",
            "justification": "Load bank test proves generator can deliver rated power under sustained load. Step loading reveals governor and AVR response. ATS integration confirms standby power system operates as designed. NFPA 110 requires Level 1 EPSS testing at full nameplate."
        },
        "logsheet": [
            "Generator Tag/ID",
            "Engine Make/Model",
            "Alternator Make/Model",
            "Rated kW",
            "Rated kVA",
            "Test Date",
            "Load Bank Make/Model",
            "Ambient Temp (°C)",
            "Start Time (s)",
            "No-Load Voltage (V)",
            "No-Load Frequency (Hz)",
            "25% Load — V (V)",
            "25% Load — I (A)",
            "25% Load — Hz",
            "25% Load — Exhaust (°C)",
            "25% Load — Coolant (°C)",
            "25% Load — Oil Press (kPa)",
            "50% Load — V/I/Hz/Temps",
            "75% Load — V/I/Hz/Temps",
            "100% Load — V/I/Hz/Temps",
            "Load Reject Recovery (s)",
            "ATS Transfer Time (s)",
            "ATS Retransfer Time (s)",
            "Fuel Consumption (L/hr @100%)",
            "Cooldown Duration (min)",
            "Pass / Fail",
            "Tested By",
            "Witnessed By",
            "Remarks"
        ],
        "tools": [
            "Resistive/reactive load bank (rated for generator output)",
            "Power analyzer (V, I, kW, kVA, PF, Hz)",
            "Exhaust gas temperature probe",
            "Coolant temperature sensor",
            "Oil pressure gauge",
            "Fuel flow meter",
            "Data logger (1-second interval minimum)",
            "Infrared thermometer"
        ],
        "safety": [
            "Hot exhaust: maintain clearance from exhaust stack",
            "Load bank generates significant heat — barricade area",
            "Fuel handling: no smoking, fire extinguisher positioned",
            "Hearing protection required (>85dBA typical)",
            "Emergency stop accessible to all personnel"
        ],
        "witness": "H",
        "duration_note": "Allow 4–8 hours per generator including all steps"
    },
    chiller_startup: {
        "title": "Chiller OEM Startup & Performance Verification",
        "procedure": [
            "Verify all pre-start requirements complete per OEM checklist",
            "Check oil level, refrigerant charge, control power, safety interlocks",
            "Perform first compressor start under OEM supervision",
            "Monitor suction pressure, discharge pressure, oil differential",
            "Record vibration baseline at bearings (3-axis)",
            "Ramp to design load gradually — 25%, 50%, 75%, 100%",
            "At design load: measure evaporator and condenser approach temperatures",
            "Calculate cooling capacity (kW/ton) at design conditions",
            "Test lead/lag staging sequence",
            "Verify high-pressure, low-pressure, and oil safety cutouts",
            "Record all data for OEM warranty validation"
        ],
        "acceptance": {
            "criteria": "Capacity within ±{capacity_pct}% of nameplate at design conditions. IPLV matches ±10% of submitted data. All safety cutouts functional. Vibration within ISO 10816 limits.",
            "standard": "ASHRAE 90.1 §6.4.1, ARI 550/590, ISO 10816 (vibration)",
            "justification": "OEM-supervised startup is required for warranty activation. Performance verification at design conditions confirms the chiller meets its efficiency guarantee. Safety cutout testing prevents catastrophic compressor failure."
        },
        "logsheet": [
            "Chiller Tag/ID",
            "Manufacturer/Model",
            "Refrigerant Type",
            "Rated Capacity (kW)",
            "Test Date",
            "OEM Technician Name",
            "Evap Entering Water Temp (°C)",
            "Evap Leaving Water Temp (°C)",
            "Cond Entering Water Temp (°C)",
            "Cond Leaving Water Temp (°C)",
            "Evap Flow Rate (L/s)",
            "Compressor Amps (A)",
            "Compressor kW",
            "Calculated kW/ton",
            "Suction Pressure (kPa)",
            "Discharge Pressure (kPa)",
            "Oil Differential (kPa)",
            "Vibration X/Y/Z (mm/s)",
            "High Pressure Cutout OK",
            "Low Pressure Cutout OK",
            "Oil Pressure Cutout OK",
            "Pass / Fail",
            "Tested By",
            "OEM Witness",
            "Remarks"
        ],
        "tools": [
            "Refrigerant manifold gauges",
            "Vibration analyzer (3-axis)",
            "Ultrasonic flow meter",
            "Power analyzer",
            "Oil sampling kit",
            "Temperature probes (calibrated)"
        ],
        "safety": [
            "Refrigerant: R-410A/R-134a safety data — ventilation required",
            "Rotating machinery: no loose clothing, maintain guard integrity",
            "High pressure: do not open service valves under pressure",
            "OEM technician must be present for first start"
        ],
        "witness": "H",
        "duration_note": "Allow 1–2 days per chiller including performance mapping"
    },
    dlc_startup: {
        "title": "Direct Liquid Cooling System Startup",
        "procedure": [
            "Verify all piping pressure tested and flushed",
            "Fill CDU with approved coolant (propylene glycol or dielectric fluid)",
            "Pressurize system to design pressure — verify no leaks",
            "Purge all air from system using auto-vent valves",
            "Start CDU pumps — verify flow rate matches design",
            "Balance flow across all manifold zones (±{flow_tolerance}% per zone)",
            "Verify per-rack flow using inline flow meters",
            "Activate leak detection system — verify all zones reporting",
            "Simulate leak at test point — verify alarm and auto-isolation",
            "Start CDU heat exchangers — verify primary/secondary ΔT",
            "Test CDU redundancy: trip primary CDU, verify backup pickup",
            "Verify coolant quality: pH {ph_range}, conductivity < {cond_max} µS/cm"
        ],
        "acceptance": {
            "criteria": "Zone flow within ±{flow_tolerance}% of design. Per-rack flow within ±10%. CDU failover: flow maintained ≥95%, temp excursion ≤2°C. Leak detection: alarm within 30s. Coolant quality within spec.",
            "standard": "ASHRAE TC9.9 Liquid Cooling Guidelines, OEM CDU specifications",
            "justification": "DLC systems are unfamiliar to many commissioning teams. Rigorous startup procedure prevents coolant leaks (which can destroy IT equipment), ensures thermal balance across all racks, and validates redundancy for CDU failure scenarios."
        },
        "logsheet": [
            "CDU Tag/ID",
            "Manufacturer/Model",
            "Coolant Type",
            "Design Pressure (kPa)",
            "Test Date",
            "System Fill Volume (L)",
            "Coolant pH",
            "Coolant Conductivity (µS/cm)",
            "CDU Pump Flow (L/min)",
            "Zone 1 Flow (L/min)",
            "Zone 2 Flow (L/min)",
            "Zone 3 Flow (L/min)",
            "Zone 4 Flow (L/min)",
            "Per-Rack Flow Range (L/min)",
            "Max Deviation from Design (%)",
            "Leak Detection Test — Alarm Time (s)",
            "Auto-Isolation Valve — Response (s)",
            "CDU Failover — Flow Maintained (%)",
            "CDU Failover — Temp Excursion (°C)",
            "Primary CDU Inlet/Outlet Temp (°C)",
            "Secondary Cooling Inlet/Outlet (°C)",
            "Pass / Fail",
            "Tested By",
            "Witnessed By",
            "Remarks"
        ],
        "tools": [
            "Ultrasonic/inline flow meters",
            "Coolant quality test kit (pH, conductivity)",
            "Pressure gauges (calibrated)",
            "Leak detection test solution",
            "Thermal camera",
            "Temperature data loggers (per-rack)"
        ],
        "safety": [
            "Coolant spill: containment trays under all connections",
            "Wet floor hazard — anti-slip matting",
            "Some coolants are slippery — wipe immediately",
            "Verify MSDS for coolant type on file and accessible"
        ],
        "witness": "H",
        "duration_note": "Allow 2–5 days for large DLC systems depending on rack count"
    },
    flow_balance: {
        "title": "Flow Balancing & Commissioning",
        "procedure": [
            "Verify all piping installation complete and pressure tested",
            "Start pump(s) and establish flow in circuit",
            "Measure total system flow at pump discharge",
            "Set balancing valves starting from index run (furthest branch)",
            "Measure and record flow at each branch/zone using ultrasonic flow meter",
            "Adjust balancing valves to achieve design flow ±{tolerance}%",
            "Verify system ΔP at design flow rate",
            "Record pump operating point on performance curve",
            "Check for cavitation, vibration, or noise anomalies",
            "Final sweep: re-verify all branches after all adjustments complete"
        ],
        "acceptance": {
            "criteria": "Branch flow within ±{tolerance}% of design. Total system flow within ±5% of design. No cavitation or abnormal vibration.",
            "standard": "ASHRAE Guideline 0-2019, CIBSE Code W, NEBB Procedural Standards",
            "justification": "Proper flow balance ensures each zone receives design cooling capacity. Imbalanced flow causes hot spots and wasted pump energy. Verification after all adjustments confirms system operates as designed."
        },
        "logsheet": [
            "System / Loop ID",
            "Design Total Flow (L/s)",
            "Test Date",
            "Pump Tag",
            "Pump Speed / VFD Setting",
            "Flow Meter Make/Model",
            "Branch/Zone ID",
            "Design Flow (L/s)",
            "Measured Flow (L/s)",
            "Deviation (%)",
            "Valve Position (turns)",
            "System ΔP (kPa)",
            "Pump Discharge Pressure (kPa)",
            "Pump Suction Pressure (kPa)",
            "Total Measured Flow (L/s)",
            "Pass / Fail",
            "Balanced By",
            "Witnessed By",
            "Remarks"
        ],
        "tools": [
            "Ultrasonic flow meter (clamp-on)",
            "Differential pressure gauge",
            "Balancing valve adjustment tool",
            "Pump curve datasheet",
            "Temperature probes (supply/return)"
        ],
        "safety": [
            "Wet floor hazard — anti-slip measures",
            "Pump mechanical seal: check for leaks during operation",
            "Hearing protection near pumps if >80dBA"
        ],
        "witness": "W",
        "duration_note": "Allow 1–2 days for large systems, 2–4 hours for small loops"
    },
    airflow_balance: {
        "title": "Air System Balancing — {system_name}",
        "procedure": [
            "Verify all fans operational at design speed/frequency",
            "Set all dampers to design position (full open for balancing)",
            "Measure total supply airflow using traverse method at main duct: {design_cfm} CFM design",
            "Measure return airflow at main return duct",
            "Calculate outdoor air percentage from temperature/CO₂ measurements",
            "Measure airflow at each supply diffuser/grille — record vs design",
            "Adjust dampers to balance: each outlet within ±10% of design",
            "Measure room-to-room pressure differentials",
            "Verify positive pressure in data hall relative to adjacent spaces",
            "For underfloor supply: measure tile airflow for each perforated tile",
            "Record fan speed (RPM), motor current (A), and static pressure (Pa)"
        ],
        "acceptance": {
            "criteria": "Total supply airflow within ±10% of design ({design_cfm} CFM). Each outlet within ±10% of design. Room pressure differentials per design (data hall positive). Fan motor current below FLA.",
            "standard": "ASHRAE 111-2008 (Measurement/Testing/Adjusting/Balancing), NEBB Procedural Standards, AABC Standards",
            "justification": "Proper air balancing ensures cooling capacity reaches all equipment locations. Imbalanced airflow causes hot spots and wasted cooling energy. Room pressurization prevents contaminant ingress."
        },
        "logsheet": [
            "System/AHU ID",
            "Zone",
            "Design Airflow (CFM)",
            "Measured Airflow (CFM)",
            "Deviation (%)",
            "Fan Speed (RPM)",
            "Motor Current (A)",
            "Static Pressure (Pa)",
            "Room DP (Pa)",
            "Supply Temp (°C)",
            "Return Temp (°C)",
            "Pass / Fail",
            "Balancer Signature"
        ],
        "tools": [
            "Balometer/capture hood",
            "Hot-wire anemometer",
            "Pitot tube + manometer for duct traverse",
            "Digital manometer for room DP",
            "Tachometer",
            "Clamp-on ammeter"
        ],
        "safety": [
            "Working at height for ceiling diffuser measurements",
            "Rotating equipment guards in place",
            "Hearing protection near large AHUs",
            "Confined space entry for large plenums if required"
        ],
        "witness": "R",
        "duration_note": "Allow 1–3 days per air handling system depending on size"
    },
    vfd_test: {
        "title": "Variable Frequency Drive Functional Test — {vfd_tag}",
        "procedure": [
            "Verify VFD nameplate: rated voltage, current, HP/kW, frequency range",
            "Check input and output power wiring — torque and phase rotation",
            "Verify grounding and EMC shielding per manufacturer spec",
            "Program drive parameters: min/max frequency, acceleration/deceleration ramp, V/Hz curve",
            "Start motor at minimum frequency — verify smooth rotation, no vibration",
            "Ramp to 25% speed — record voltage, current, frequency, motor vibration",
            "Ramp to 50% speed — record same parameters",
            "Ramp to 100% speed — record same parameters, verify rated current within FLA",
            "Test bypass transfer (if equipped): VFD→bypass and bypass→VFD",
            "Test emergency stop — verify drive stops within {stop_time} seconds",
            "Test fault conditions: overload, phase loss, ground fault — verify trip and alarm",
            "Measure input THD with power quality analyzer at 100% load",
            "Verify BMS communication: speed command, run status, fault status"
        ],
        "acceptance": {
            "criteria": "Speed accuracy within ±0.5% of setpoint. Current at rated speed within motor FLA. THDi within filter specification (typically <5% at PCC). Bypass transfer seamless (no motor stop). All faults trigger appropriate alarm within 2 seconds.",
            "standard": "NETA ATS-2025 §7.15, IEC 61800-3 (EMC), IEEE 519 (Harmonics)",
            "justification": "VFDs control critical cooling pumps and fans. Speed accuracy ensures designed flow rates. Harmonic compliance prevents power quality issues affecting other loads. Bypass function is critical for maintenance without cooling interruption."
        },
        "logsheet": [
            "VFD Tag/ID",
            "Manufacturer/Model",
            "Rated kW/HP",
            "Driven Equipment",
            "Test Date",
            "Min Freq (Hz)",
            "Max Freq (Hz)",
            "Current at 100% (A)",
            "Motor FLA (A)",
            "THDi at PCC (%)",
            "Bypass Transfer",
            "E-Stop Response (sec)",
            "Vibration at Rated (mm/s)",
            "BMS Comms",
            "Pass / Fail",
            "Technician Signature"
        ],
        "tools": [
            "Power quality analyzer (Fluke 435-II or equivalent)",
            "Clamp-on ammeter",
            "Vibration analyzer",
            "Tachometer/strobe",
            "VFD programming software/keypad",
            "Megohmmeter (pre-start)"
        ],
        "safety": [
            "Lock-out/tag-out before wiring checks",
            "Stored energy in DC bus — wait 5 min after power off",
            "Arc flash PPE for energized work at VFD",
            "Verify motor coupling guard in place before start"
        ],
        "witness": "W",
        "duration_note": "Allow 2–3 hours per VFD including parameter setup"
    },
    functional_sequence: {
        "title": "Functional & Control Sequence Test",
        "procedure": [
            "Review approved sequence of operation for {system_name}",
            "Verify all components operational and BMS P2P complete",
            "Initiate sequence start condition",
            "Observe automatic staging: lead equipment starts, lag follows at setpoint",
            "Verify PID loop response: setpoint change → stable output within {settle_time}",
            "Test all failure modes: lead fails → lag takes over automatically",
            "Test safety interlocks: {interlock_list}",
            "Verify economizer changeover at appropriate conditions",
            "Record all BMS trend data during test (minimum 5-min interval)",
            "Test emergency shutdown/EPO response for this system"
        ],
        "acceptance": {
            "criteria": "Sequence executes per approved SOO. Staging occurs at correct setpoints ±{setpoint_tolerance}. PID settles within {settle_time}. All failure modes result in correct automatic response. Safety interlocks operational.",
            "standard": "ASHRAE Guideline 0-2019, ASHRAE Guideline 36-2021, NFPA 72 (fire interlock)",
            "justification": "Functional testing proves that control sequences operate as designed under all normal and failure conditions. This is the bridge between individual component testing (L3) and integrated systems testing (L5). Sequences that fail here will cause IST failures."
        },
        "logsheet": [
            "System/Sequence",
            "SOO Reference",
            "Test Date",
            "Start Condition",
            "Lead Equipment Response",
            "Lag Staging Setpoint",
            "Actual Staging Point",
            "PID Setpoint",
            "PID Actual",
            "Settle Time (min)",
            "Failure Mode Tested",
            "Failure Mode Response OK",
            "Interlock Tested",
            "Interlock Response OK",
            "BMS Trend Data Captured",
            "Pass / Fail",
            "Tested By",
            "Witnessed By",
            "Remarks"
        ],
        "tools": [
            "BMS operator workstation",
            "Process variable simulators",
            "Two-way radio",
            "Temperature/pressure/flow instruments for independent verification",
            "Stopwatch/timer"
        ],
        "safety": [
            "Coordinate test with operations — equipment may start/stop unexpectedly",
            "Ensure all personnel clear of rotating equipment before sequence start",
            "Fire interlock testing: notify fire department if connected to central station"
        ],
        "witness": "W",
        "duration_note": "Allow 2–4 hours per major sequence"
    },
    ist_scenario: {
        "title": "Integrated Systems Test (IST) Scenario",
        "procedure": [
            "Pre-IST readiness review: all L4 tests complete, no open critical defects",
            "Brief all participants: test director, operations, CxA, witnesses",
            "Verify load condition: {load_condition}",
            "Start video and data logging (minimum 1-second interval)",
            "Execute scenario: {scenario_description}",
            "Monitor all parameters: voltage, current, frequency, temperature, alarms",
            "Record exact time of each event in test log",
            "Verify acceptance criteria met at each step",
            "If failure: stop test, document failure mode, initiate NCR",
            "If success: continue monitoring for {stabilize_min} minutes",
            "De-brief: review results, document lessons learned",
            "Compile IST report section for this scenario"
        ],
        "acceptance": {
            "criteria": "{acceptance_specific}",
            "standard": "Uptime Institute Tier Standard, ASHRAE Guideline 0-2019 §5.5, BICSI 002",
            "justification": "IST validates that all building systems work together under realistic failure conditions. Individual equipment testing (L1-L4) proves components work; IST proves the integrated system provides the required redundancy and availability. This is the most critical phase of commissioning."
        },
        "logsheet": [
            "IST Scenario ID",
            "Scenario Description",
            "Test Date/Time",
            "Test Director",
            "Load Condition",
            "Load Level (%)",
            "Pre-Test Status (all green)",
            "Event 1 — Time/Description",
            "Event 1 — Parameter Readings",
            "Event 2 — Time/Description",
            "Event 2 — Parameter Readings",
            "Event 3 — Time/Description",
            "Event 3 — Parameter Readings",
            "IT Load Interruption Duration (ms)",
            "Temperature Excursion (°C)",
            "Transfer Time (ms)",
            "Recovery Time (min)",
            "Alarms Generated",
            "Anomalies Observed",
            "Pass / Fail",
            "Test Director Signature",
            "CxA Signature",
            "Owner Witness Signature",
            "Remarks"
        ],
        "tools": [
            "Power quality analyzers (all distribution points)",
            "Temperature sensors (all zones)",
            "Data acquisition system (1-second minimum)",
            "Video cameras (control room + switchrooms)",
            "Two-way radios (all test stations)",
            "Load bank (if live IT load not available)",
            "Emergency response team on standby"
        ],
        "safety": [
            "Full IST safety briefing before each scenario",
            "All participants know their roles and abort criteria",
            "Medical first aid kit and AED on site",
            "Fire watch during generator run periods",
            "Operations control room manned throughout test"
        ],
        "witness": "H",
        "duration_note": "Allow 2–4 hours per scenario including setup and debrief"
    },
    doc_review: {
        "title": "Document Review & Planning Activity",
        "procedure": [
            "Assemble review team: CxA lead, design engineer, operations representative",
            "Distribute documents minimum {review_days} working days before review meeting",
            "Each reviewer prepares written comments referencing specific document sections",
            "Conduct review meeting: walk through document section by section",
            "Record all comments, required changes, and action items",
            "Assign owners and deadlines for each action item",
            "Revise document incorporating agreed changes",
            "Re-issue for final acceptance and sign-off"
        ],
        "acceptance": {
            "criteria": "All review comments resolved or formally deferred. Document approved by all required signatories. No unresolved safety or compliance items.",
            "standard": "ASHRAE Guideline 0-2019 §4.1-4.3",
            "justification": "Design review and planning are where 80% of commissioning success is determined. Errors caught during L0 cost 10× less to fix than errors found during L5 IST. Formal review with multi-discipline input prevents scope gaps and misalignment."
        },
        "logsheet": [
            "Document Title/Number",
            "Revision",
            "Review Date",
            "Review Attendees",
            "Comment #",
            "Section/Page",
            "Comment Description",
            "Response/Resolution",
            "Action Owner",
            "Due Date",
            "Status",
            "Final Approval By",
            "Approval Date"
        ],
        "tools": [
            "Document management system access",
            "Review meeting room / video conference",
            "Action tracking register"
        ],
        "safety": [
            "N/A — office-based activity"
        ],
        "witness": "R",
        "duration_note": "Allow 1–5 days depending on document complexity"
    },
    training: {
        "title": "Operations Staff Training & Competency Verification",
        "procedure": [
            "Identify training requirements per system and role",
            "Develop training materials: presentations, hands-on exercises, emergency procedures",
            "Schedule training sessions with adequate lead time",
            "Conduct classroom training on system theory and operation",
            "Conduct hands-on training at equipment location",
            "Trainee demonstrates competency: performs {competency_tasks}",
            "Assess trainee: written test or practical evaluation",
            "Issue training completion certificate",
            "Record all training in competency matrix"
        ],
        "acceptance": {
            "criteria": "All designated operations staff complete required training modules. Written/practical assessment score ≥ {pass_score}%. Training completion matrix 100% for critical systems before RFS.",
            "standard": "ASHRAE Guideline 0-2019 §5.7, OSHA training requirements, NFPA 70E (electrical safety)",
            "justification": "Trained operations staff are essential for facility availability. Untrained operators cause incidents, extend outage durations, and void equipment warranties. Training must occur before turnover to ensure safe and competent facility operation."
        },
        "logsheet": [
            "Training Module",
            "System/Equipment",
            "Training Date",
            "Trainer Name/Qualification",
            "Trainee Name",
            "Trainee Role",
            "Classroom Hours",
            "Hands-On Hours",
            "Assessment Type",
            "Assessment Score (%)",
            "Pass / Fail",
            "Certificate Number",
            "Trainer Signature",
            "Trainee Signature"
        ],
        "tools": [
            "Training materials/presentations",
            "Equipment access for hands-on sessions",
            "Assessment forms",
            "Competency matrix tracking spreadsheet"
        ],
        "safety": [
            "Trainees must have appropriate PPE for hands-on sessions",
            "Supervision ratio: maximum 4 trainees per instructor for hands-on",
            "Emergency procedures reviewed before any hands-on exercise"
        ],
        "witness": "R",
        "duration_note": "Allow 1–2 days per system per training group"
    },
    closeout: {
        "title": "Commissioning Closeout & Documentation",
        "procedure": [
            "Compile all test reports, certificates, and logsheets per phase",
            "Verify punch list: all critical and major items resolved",
            "Document residual risks with mitigation plans and owner acceptance",
            "Compile O&M manuals: as-built drawings, SOPs, PM schedules",
            "Verify spare parts inventory against approved list",
            "Assemble turnover pack: document index, warranty register, contact list",
            "Conduct final facility walkthrough with owner",
            "Present final commissioning report to owner",
            "Obtain all required signatures on turnover certificate",
            "Archive all records per document retention policy"
        ],
        "acceptance": {
            "criteria": "All critical punch list items resolved. Residual risks formally accepted. O&M documentation complete. Spare parts verified. Training complete. All signatures obtained on turnover certificate.",
            "standard": "ASHRAE Guideline 0-2019 §5.7-5.8, Uptime Institute Tier Certification",
            "justification": "Closeout determines what the customer actually receives. A facility that passes IST but lacks documentation, training, and spare parts is not ready for service. Formal closeout with signed acceptance protects both the commissioning agent and the owner."
        },
        "logsheet": [
            "Project Name",
            "Closeout Date",
            "Punch List — Total Items",
            "Punch List — Critical Open",
            "Punch List — Major Open",
            "Punch List — Minor Open",
            "Residual Risks Accepted",
            "O&M Manuals Delivered",
            "As-Built Drawings Delivered",
            "Training Complete",
            "Spare Parts Verified",
            "Final Cx Report Issued",
            "Turnover Certificate Signed",
            "CxA Lead Signature",
            "Owner Representative Signature",
            "Date of RFS Declaration",
            "Remarks / Conditions"
        ],
        "tools": [
            "Document management system",
            "Punch list tracking tool",
            "Checklist templates"
        ],
        "safety": [
            "N/A — primarily office-based"
        ],
        "witness": "R",
        "duration_note": "Allow 1–2 weeks for documentation compilation and review meetings"
    },
    visual_inspection: {
        "title": "Visual & Mechanical Inspection",
        "procedure": [
            "Review approved drawings and specifications for inspection criteria",
            "Inspect {component} installation against design documents",
            "Verify physical condition: no damage, corrosion, or contamination",
            "Check alignment, levelness, and clearances per specification",
            "Verify labeling and identification per drawing schedule",
            "Check all bolted connections for specified torque",
            "Verify seismic bracing and anchorage (if applicable)",
            "Document all observations with photographs",
            "Mark any discrepancies on as-built drawings"
        ],
        "acceptance": {
            "criteria": "Installation conforms to approved drawings. No visible damage or defects. All connections torqued to specification. Labels match drawing schedule.",
            "standard": "NETA ATS-2025 §7.1 (Visual/Mechanical), NFPA 70 NEC",
            "justification": "Visual inspection catches installation errors before energization. Incorrect installation can cause equipment failure, fire, or personnel injury during startup. This is the first and most fundamental verification step."
        },
        "logsheet": [
            "Equipment/Area",
            "Drawing Reference",
            "Test Date",
            "Physical Condition OK",
            "Alignment/Level OK",
            "Clearances OK",
            "Bolted Connections Torqued",
            "Labels Correct",
            "Seismic Bracing OK",
            "Photos Taken (ref #)",
            "Discrepancies Found",
            "Pass / Fail",
            "Inspected By",
            "Witnessed By",
            "Remarks"
        ],
        "tools": [
            "Torque wrench (calibrated)",
            "Spirit level",
            "Tape measure",
            "Camera/phone for documentation",
            "Flashlight",
            "Inspection mirror"
        ],
        "safety": [
            "Hard hat, safety shoes, high-vis vest in construction areas",
            "Watch for overhead loads — crane operations",
            "Trip/fall hazards on construction site"
        ],
        "witness": "R",
        "duration_note": "Allow 30–60 min per major equipment item"
    },
    pressure_test: {
        "title": "Hydrostatic Pressure Test",
        "procedure": [
            "Isolate test section with blind flanges or closed valves",
            "Fill system slowly from lowest point to minimize air pockets",
            "Vent air from all high points using manual air vents",
            "Pressurize to {test_pressure} ({test_factor}× design pressure)",
            "Hold pressure for {hold_hours} hours minimum",
            "Monitor pressure gauge continuously — record readings every 15 min",
            "Inspect all joints, flanges, welds, and connections for leaks",
            "Record ambient temperature at start and end (pressure varies with temp)",
            "Depressurize slowly after successful hold",
            "Document all observations and pressure readings"
        ],
        "acceptance": {
            "criteria": "No visible leaks. Pressure drop ≤ {max_drop} over {hold_hours}-hour hold period (temperature-corrected).",
            "standard": "ASME B31.1/B31.3, ASHRAE Guideline 0-2019 §5.3",
            "justification": "Hydrostatic test proves piping system integrity before introducing process fluid. Confirms weld quality, joint tightness, and pressure rating of all components. Required before chilled water, condenser water, or coolant loop commissioning."
        },
        "logsheet": [
            "System / Loop ID",
            "Design Pressure (kPa)",
            "Test Pressure (kPa)",
            "Test Medium",
            "Test Date",
            "Gauge Make/Model/SN",
            "Gauge Range/Accuracy",
            "Start Time",
            "Start Pressure (kPa)",
            "Start Ambient Temp (°C)",
            "15-min Reading",
            "30-min Reading",
            "45-min Reading",
            "60-min Reading",
            "90-min Reading",
            "120-min Reading",
            "End Pressure (kPa)",
            "End Ambient Temp (°C)",
            "Pressure Drop (kPa)",
            "Leaks Found (Y/N)",
            "Leak Location(s)",
            "Pass / Fail",
            "Tested By",
            "Witnessed By",
            "Remarks"
        ],
        "tools": [
            "Calibrated pressure gauge (test range appropriate)",
            "Hydrostatic test pump",
            "Temperature logger",
            "Inspection mirror and flashlight",
            "Leak detection fluid (for gas systems)"
        ],
        "safety": [
            "High pressure: maintain safe distance from test section",
            "Never use compressed gas for hydrostatic test",
            "Ensure adequate pressure relief/safety valve",
            "PPE: safety glasses, face shield if high pressure"
        ],
        "witness": "H",
        "duration_note": "Allow 3–4 hours per test section including fill and hold"
    },
};

/** A template with all {placeholder} params substituted. */
export type ResolvedProc = CxProcTemplate;

/** Same substitution as cx-calculator cxGetProcedure(): {key} → params[key],
 *  falling back to the bare key name when the param is missing. Applied to
 *  title, procedure, acceptance.criteria, acceptance.justification, tools,
 *  safety and duration_note (NOT acceptance.standard — source parity). */
export function resolveProc(templateKey: CxTemplateKey, params: Record<string, string>): ResolvedProc | null {
    const t = CX_PROC_TEMPLATES[templateKey];
    if (!t) return null;
    const sub = (s: string): string => s.replace(/\{(\w+)\}/g, (_, k: string) => params[k] || k);
    return {
        title: sub(t.title),
        procedure: t.procedure.map(sub),
        acceptance: { criteria: sub(t.acceptance.criteria), standard: t.acceptance.standard, justification: sub(t.acceptance.justification) },
        logsheet: [...t.logsheet],
        tools: t.tools.map(sub),
        safety: t.safety.map(sub),
        witness: t.witness,
        duration_note: sub(t.duration_note),
    };
}

/* ─── Readiness checklist mapping ────────────────────────────────────────── */

/** Engine readinessIndex keys (rz-engine DATA.commissioning.weights). */
export type ReadinessKey = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'ist' | 'sat' | 'fat' | 'punchlist';

/** Equipment-scaling system keys (programRich equip) + 'general' (always shown). */
export type CxSystemKey = 'switchgear' | 'ups_modules' | 'generators' | 'chillers' | 'cooling_units' | 'pdus' | 'fireZones' | 'general';

export interface ChecklistItem {
    id: string;
    templateKey: CxTemplateKey;
    /** Real parameter set harvested from the cx-calculator CX_ACTIVITY_MAP. */
    params: Record<string, string>;
    label: string;
    /** Only shown when coolingType is 'liquid' or 'rdhx' (engine mech_dlc condition). */
    liquidOnly?: true;
}

export interface ChecklistGroup {
    systemKey: CxSystemKey;
    items: ChecklistItem[];
}

const P_IR_SWGR = { voltage_class: '15kV', min_ir: '100MΩ', test_voltage: '5kV' };
const P_UPS = { transfer_ms: '4', thd_pct: '5', eff_pct: '95', autonomy_min: '10' };
const P_CABLE = { min_ir: '5MΩ/kV', max_att: '0.4' };
const P_GEN_LB = {
    start_time: '10', step1_pct: '25', step1_min: '30', step2_pct: '50', step2_min: '30',
    step3_pct: '75', step3_min: '30', step4_pct: '100', step4_min: '120',
    ats_time: '10', exhaust_max: '550', coolant_max: '95', cooldown_min: '15',
};
const P_DLC = { flow_tolerance: '5', ph_range: '7.0-9.0', cond_max: '100' };

/** Per readiness key → per-system groups of real Cx activities (template +
 *  CX_ACTIVITY_MAP params). Item ids are stable — they key the tick state. */
export const CX_CHECKLIST: Record<ReadinessKey, ChecklistGroup[]> = {
    fat: [
        {
            systemKey: 'switchgear', items: [
                { id: 'fat_sw_ir', templateKey: 'ir_test', params: P_IR_SWGR, label: 'MV switchgear insulation resistance (megger) — factory' },
                { id: 'fat_sw_ct', templateKey: 'ct_ratio_test', params: { ratio_tolerance: '0.5%' }, label: 'CT ratio & polarity verification' },
                { id: 'fat_tx_hr', templateKey: 'transformer_test', params: { heat_run_hours: '8', temp_rise: '65' }, label: 'Transformer factory tests incl. 8h heat run' },
            ],
        },
        {
            systemKey: 'ups_modules', items: [
                { id: 'fat_ups', templateKey: 'ups_test', params: P_UPS, label: 'UPS factory witness test (transfer, THD, efficiency, autonomy)' },
            ],
        },
    ],
    L1: [
        {
            systemKey: 'switchgear', items: [
                { id: 'l1_sw_vi', templateKey: 'visual_inspection', params: { component: 'bus bar connections' }, label: 'Visual/mechanical inspection — bus bar connections' },
                { id: 'l1_sw_cb', templateKey: 'cable_test', params: P_CABLE, label: 'MV/LV feeder cable test (IR + continuity)' },
            ],
        },
        {
            systemKey: 'generators', items: [
                { id: 'l1_gn_vi', templateKey: 'visual_inspection', params: { component: 'generator anti-vibration mounts' }, label: 'Visual/mechanical inspection — anti-vibration mounts' },
                { id: 'l1_gn_cb', templateKey: 'cable_test', params: P_CABLE, label: 'Generator supply/control cable test' },
            ],
        },
        {
            systemKey: 'ups_modules', items: [
                { id: 'l1_up_vi', templateKey: 'visual_inspection', params: { component: 'UPS battery rack and inter-cell connections' }, label: 'Visual/mechanical inspection — battery rack & inter-cell connections' },
            ],
        },
        {
            systemKey: 'cooling_units', items: [
                { id: 'l1_cu_vi', templateKey: 'visual_inspection', params: { component: 'fan motor and VFD' }, label: 'Visual/mechanical inspection — fan motor and VFD' },
            ],
        },
        {
            systemKey: 'pdus', items: [
                { id: 'l1_pd_vi', templateKey: 'visual_inspection', params: { component: 'busway joint integrity and torque marks' }, label: 'Visual/mechanical inspection — busway joints & torque marks' },
            ],
        },
        {
            systemKey: 'fireZones', items: [
                { id: 'l1_fz_vi', templateKey: 'visual_inspection', params: { component: 'suppression agent quantity' }, label: 'Visual inspection — suppression agent quantity' },
            ],
        },
    ],
    L2: [
        {
            systemKey: 'switchgear', items: [
                { id: 'l2_sw_bk', templateKey: 'breaker_test', params: { close_ms: '80', open_ms: '50', cr_uohm: '100', cycle_count: '5' }, label: 'MV breaker timing & contact resistance test' },
            ],
        },
        {
            systemKey: 'generators', items: [
                { id: 'l2_gn_pp', templateKey: 'pressure_test', params: { test_pressure: '150kPa', test_factor: '1.5', hold_hours: '2', max_drop: '0kPa' }, label: 'Fuel piping pressure test (150kPa, 2h hold)' },
            ],
        },
        {
            systemKey: 'chillers', items: [
                { id: 'l2_ch_pp', templateKey: 'pressure_test', params: { test_pressure: '1.5× design', test_factor: '1.5', hold_hours: '2', max_drop: '0kPa' }, label: 'CHW piping hydrostatic pressure test (1.5× design)' },
            ],
        },
        {
            systemKey: 'cooling_units', items: [
                { id: 'l2_cu_vfd', templateKey: 'vfd_test', params: { vfd_tag: 'sample VFD', stop_time: '5' }, label: 'VFD parameter & rotation test' },
            ],
        },
    ],
    L3: [
        {
            systemKey: 'ups_modules', items: [
                { id: 'l3_up_st', templateKey: 'ups_test', params: P_UPS, label: 'UPS site test — battery discharge & transfer' },
            ],
        },
        {
            systemKey: 'generators', items: [
                { id: 'l3_gn_lb', templateKey: 'generator_load_bank', params: P_GEN_LB, label: 'Generator load bank test (25/50/75/100% steps)' },
            ],
        },
        {
            systemKey: 'chillers', items: [
                { id: 'l3_ch_su', templateKey: 'chiller_startup', params: { capacity_pct: '5' }, label: 'Chiller startup & performance verification' },
                { id: 'l3_dlc_su', templateKey: 'dlc_startup', params: P_DLC, label: 'DLC/CDU loop startup (fill, flush, coolant quality)', liquidOnly: true },
            ],
        },
        {
            systemKey: 'pdus', items: [
                { id: 'l3_pd_en', templateKey: 'functional_sequence', params: { system_name: 'PDU sequential board energization', settle_time: '5min', setpoint_tolerance: '2', interlock_list: 'upstream protection, branch breakers' }, label: 'PDU sequential board energization' },
            ],
        },
        {
            systemKey: 'fireZones', items: [
                { id: 'l3_fz_fp', templateKey: 'functional_sequence', params: { system_name: 'fire pump controller', settle_time: '30s', setpoint_tolerance: '5', interlock_list: 'auto-start, phase reversal, pump running' }, label: 'Fire pump controller functional sequence' },
            ],
        },
        {
            systemKey: 'cooling_units', items: [
                { id: 'l3_cu_vl', templateKey: 'functional_sequence', params: { system_name: 'HVAC valve/damper modulation', settle_time: '60s', setpoint_tolerance: '3', interlock_list: 'BMS control, fire interlock' }, label: 'HVAC valve/damper modulation sequence' },
            ],
        },
        {
            systemKey: 'general', items: [
                { id: 'l3_ll', templateKey: 'functional_sequence', params: { system_name: 'chiller lead/lag', settle_time: '5min', setpoint_tolerance: '2', interlock_list: 'staging setpoint, anti-short-cycle timer' }, label: 'Chiller lead/lag staging sequence' },
            ],
        },
    ],
    L4: [
        {
            systemKey: 'chillers', items: [
                { id: 'l4_ch_fb', templateKey: 'flow_balance', params: { tolerance: '5' }, label: 'CHW hydronic flow balance (±5%)' },
            ],
        },
        {
            systemKey: 'cooling_units', items: [
                { id: 'l4_cu_ab', templateKey: 'airflow_balance', params: { system_name: 'office AHU/FCU', design_cfm: 'per design', measure_height: '1.0m' }, label: 'Airflow balance — AHU/FCU systems' },
            ],
        },
        {
            systemKey: 'general', items: [
                { id: 'l4_bv_ab', templateKey: 'airflow_balance', params: { system_name: 'battery room ventilation', design_cfm: 'per ASHRAE 62.1', measure_height: 'breathing zone' }, label: 'Battery room ventilation airflow verification' },
            ],
        },
    ],
    L5: [
        {
            systemKey: 'general', items: [
                { id: 'l5_bk', templateKey: 'ist_scenario', params: { load_condition: '100% design', scenario_description: 'Black start — open main utility breaker', acceptance_specific: 'UPS holds load with no interruption. Generators auto-start within 10s. Stable operation 30min minimum.', stabilize_min: '30' }, label: 'IST — black start (open main utility breaker)' },
            ],
        },
        {
            systemKey: 'ups_modules', items: [
                { id: 'l5_by', templateKey: 'ist_scenario', params: { load_condition: '100% design', scenario_description: 'UPS static bypass transfer', acceptance_specific: 'Output voltage continuous through transfer. No IT load interruption.', stabilize_min: '5' }, label: 'IST — UPS static bypass transfer' },
            ],
        },
        {
            systemKey: 'chillers', items: [
                { id: 'l5_ch', templateKey: 'ist_scenario', params: { load_condition: '100% cooling', scenario_description: 'Trip lead chiller — lag auto-starts', acceptance_specific: 'Lag chiller auto-starts within 60s. CHW supply temp maintained ≤ design + 2°C.', stabilize_min: '15' }, label: 'IST — trip lead chiller, lag auto-start' },
                { id: 'l5_cd', templateKey: 'ist_scenario', params: { load_condition: '100% IT with DLC', scenario_description: 'CDU trip — backup CDU picks up', acceptance_specific: 'Flow maintained to all racks. CDU failover within 30s.', stabilize_min: '15' }, label: 'IST — CDU failover', liquidOnly: true },
            ],
        },
    ],
    ist: [
        {
            systemKey: 'general', items: [
                { id: 'ist_epo', templateKey: 'ist_scenario', params: { load_condition: '100% design', scenario_description: 'EPO activation — full power shutdown', acceptance_specific: 'All power removed within 2 seconds of EPO activation. Recovery procedure executable within 60 minutes.', stabilize_min: '30' }, label: 'IST — EPO activation & recovery' },
                { id: 'ist_fire', templateKey: 'ist_scenario', params: { load_condition: '100% design', scenario_description: 'Fire suppression HVAC interlock', acceptance_specific: 'HVAC shutdown within 5 seconds of fire alarm. Dampers close. No power interruption to IT.', stabilize_min: '15' }, label: 'IST — fire suppression HVAC interlock' },
                { id: 'ist_cm', templateKey: 'ist_scenario', params: { load_condition: '100% design', scenario_description: 'Concurrent maintenance — isolate electrical Path A', acceptance_specific: 'Full load carried on Path B. Maintenance access to Path A components safe.', stabilize_min: '30' }, label: 'IST — concurrent maintenance (isolate Path A)' },
                { id: 'ist_cf', templateKey: 'ist_scenario', params: { load_condition: '100% IT design', scenario_description: 'Cooling failure — monitor IT inlet temperature rise', acceptance_specific: 'Temperature rise rate logged. Thermal ride-through time exceeds UPS battery autonomy.', stabilize_min: '15' }, label: 'IST — cooling failure thermal ride-through' },
            ],
        },
    ],
    sat: [
        {
            systemKey: 'general', items: [
                { id: 'sat_doc', templateKey: 'doc_review', params: { review_days: '5' }, label: 'O&M documentation & as-built review (5d cycle)' },
                { id: 'sat_tr1', templateKey: 'training', params: { competency_tasks: 'HV/MV switching per approved procedure', pass_score: '80' }, label: 'Operator training — HV/MV switching' },
                { id: 'sat_tr2', templateKey: 'training', params: { competency_tasks: 'alarm acknowledgment, escalation, response', pass_score: '80' }, label: 'Operator training — alarm acknowledgment & escalation' },
                { id: 'sat_co', templateKey: 'closeout', params: {}, label: 'Site acceptance closeout package' },
            ],
        },
    ],
    punchlist: [
        {
            systemKey: 'general', items: [
                { id: 'pl_co', templateKey: 'closeout', params: {}, label: 'Punch list burndown & turnover certificate' },
            ],
        },
    ],
};
