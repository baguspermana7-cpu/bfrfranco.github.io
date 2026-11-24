/*
 * payloads.js — window.RZConvPayloads: ONE inspector payload builder for every Conventional HMI sheet
 * (CONV_EXECUTION_PLAN_2026-11-16 AD1–AD3, AD6, AD7). DOM-free; Node loads it with require().
 *
 *   build(o)   o = { page, node:{id,sym,tag,label}, read, store, edges, mismatch, acked, declared, scenario, tick,
 *                    engineVersion }
 *              -> a frozen payload for RZInspector.openPayload: six tabs, none empty.
 *   classOf(page, sym[, node]) -> the class recipe (page-specific first, then the generic symbol class; a return-header transmitter gets the return anchor), or null.
 *   rows       every row is { label, text, unit, quality, basis | declared, sim? }:
 *                basis    = a registry id in data/conv-parameters.json; text is the registry value at the printed
 *                           precision (the registry is generated from js/conv-engine.js, so it IS the engine value).
 *                sim:true = a seeded deterministic training value (period + phase from the point id, never a
 *                           random draw); the inspector prints a visible SIM mark on it.
 *                declared = a sentence (>= 40 chars) saying where a non-engine value comes from.
 *   trend      60 ticks, seeded, anchored on the engine plane when the class has one (drawn as the reference line).
 *   maint      declared interval + the standard it comes from; the "last test" is a TRAINING RECORD fixture.
 */
(function (root) {
  'use strict';

  var REG = null;
  function registry() {
    if (REG) return REG;
    var r = root && root.RZ_CONV_PARAMETERS;
    if (!r && typeof require === 'function') { try { r = require('../../data/conv-parameters.json'); } catch (e) { r = null; } }
    if (!r || !Array.isArray(r.parameters)) return null;
    var idx = {};
    r.parameters.forEach(function (p) { idx[p.id] = p; });
    REG = { engineVersion: r.engineVersion, idx: idx };
    return REG;
  }
  function param(id) { var r = registry(); return r ? r.idx[id] || null : null; }

  function freeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.keys(o).forEach(function (k) { freeze(o[k]); });
      Object.freeze(o);
    }
    return o;
  }
  function isNum(n) { return typeof n === 'number' && isFinite(n); }
  function fmt(v, digits) {
    if (v === null || v === undefined) return '—';
    if (!isNum(v)) return String(v);
    var d = isNum(digits) ? digits : (Math.abs(v) >= 100 ? 0 : 1);
    return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  /* FNV-1a: a stable phase per point id, so two pumps never breathe in step */
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h;
  }
  function wave(key, tick, base, amp, period) {
    var ph = (hash(key) % 1000) / 1000 * Math.PI * 2, p = period || 37;
    return base + amp * Math.sin(2 * Math.PI * tick / p + ph) + amp * 0.3 * Math.sin(2 * Math.PI * tick / (p * 0.27) + ph * 1.7);
  }
  function unitOf(p) {
    var u = p && p.unit;
    if (!u || u === 'None') return '';
    return u === 'degC' ? '°C' : u;
  }

  var DECL = 'DECLARED training value for the conventional cockpit (class recipe in js/conv/payloads.js); not an engine output and not read from a field device';
  var SIMD = 'SIMULATED — seeded deterministic training signal (period and phase from the point id); no field device is read';
  var TRAINING = 'TRAINING RECORD — a deterministic fixture showing the record format; no maintenance system is read';

  /* row constructors for the recipes */
  function B(label, id, digits) { return { k: 'B', label: label, id: id, digits: digits }; }
  function S(label, unit, base, amp, digits, period) { return { k: 'S', label: label, unit: unit, base: base, amp: amp, digits: digits, period: period }; }
  function SB(label, id, amp, digits, period) { return { k: 'SB', label: label, id: id, amp: amp, digits: digits, period: period }; }
  function D(label, text) { return { k: 'D', label: label, text: text }; }

  /* standards cited at document level (clause numbers only where the interval is the clause's own wording) */
  var STD = {
    nfpa25pump: ['Fire pump churn (no-flow) test', 'weekly (diesel driver) / monthly (electric driver); flow test annually', 'NFPA 25 — fire pumps'],
    nfpa25valveCtl: ['Control valve inspection + operation', 'inspect weekly (sealed) or monthly (locked / supervised); operate annually', 'NFPA 25 — valves, valve components and trim'],
    nfpa25check: ['Check valve internal inspection', 'every 5 years', 'NFPA 25 — valves, valve components and trim'],
    nfpa25alarm: ['Alarm valve inspection + main drain test', 'inspect quarterly; main drain test annually', 'NFPA 25 — sprinkler systems'],
    nfpa25preact: ['Pre-action valve trip test', 'partial-flow trip test annually; full-flow trip test every 3 years', 'NFPA 25 — preaction and deluge valves'],
    nfpa25spr: ['Sprinkler inspection from floor level', 'annually', 'NFPA 25 — sprinkler systems'],
    nfpa25tank: ['Water storage tank level + interior inspection', 'level monthly; interior every 5 years', 'NFPA 25 — water storage tanks'],
    nfpa25air: ['Nitrogen / air supervisory supply check', 'quarterly', 'NFPA 25 — preaction and dry-pipe systems'],
    nfpa72facp: ['Control unit functional test; VRLA battery test', 'control unit annually; batteries semiannually', 'NFPA 72 — inspection, testing and maintenance'],
    nfpa72det: ['Smoke detector functional test; sensitivity test', 'functional annually; sensitivity within 1 year of install, then every alternate year', 'NFPA 72 — inspection, testing and maintenance'],
    nfpa72asd: ['Aspirating detector transport-time + smoke test', 'annually', 'NFPA 72 — inspection, testing and maintenance'],
    nfpa72init: ['Initiating device functional test', 'annually', 'NFPA 72 — inspection, testing and maintenance'],
    nfpa110gen: ['Generator exercise under load', 'inspect weekly; exercise monthly >= 30 min at >= 30 % of nameplate', 'NFPA 110 — emergency and standby power systems'],
    nfpa110fuel: ['Fuel quality test', 'annually (ASTM D975 sampling)', 'NFPA 110 — emergency and standby power systems'],
    nfpa110filter: ['Fuel filter inspection / change', 'inspect weekly with the EPSS; change on differential-pressure alarm or manufacturer interval', 'NFPA 110 — emergency and standby power systems'],
    ust: ['Interstitial leak-detection check', 'monthly', 'US 40 CFR 280 practice for underground storage tanks'],
    a180chiller: ['Chiller operating-log review; condenser + evaporator inspection', 'log monthly; tube inspection annually', 'ASHRAE/ACCA 180 — chiller table'],
    a180pump: ['Pump inspection; alignment + vibration check', 'inspect quarterly; alignment and vibration annually', 'ASHRAE/ACCA 180 — pump table'],
    a180valve: ['Valve exercise + actuator check', 'annually', 'ASHRAE/ACCA 180 — piping and valves'],
    a180coil: ['Coil + filter inspection', 'quarterly', 'ASHRAE/ACCA 180 — air handling units'],
    a180tank: ['Expansion tank pre-charge check', 'annually', 'ASHRAE/ACCA 180 — hydronic systems'],
    a180hx: ['Heat-exchanger approach review + plate/tube inspection', 'approach monthly; inspection annually', 'ASHRAE/ACCA 180 — heat exchangers'],
    a188tower: ['Cooling tower inspection under the water management program', 'monthly; Legionella sampling per the program', 'ASHRAE 188 + ASHRAE/ACCA 180 — cooling towers'],
    water: ['Water-treatment equipment check', 'weekly per the water management program', 'ASHRAE 188 — water management program'],
    uv: ['UV lamp intensity check + lamp change', 'intensity weekly; lamp per rated hours (manufacturer)', 'Manufacturer O&M under the ASHRAE 188 program'],
    cal: ['Transmitter calibration check', 'annually (site metrology program)', 'ISO 10012 measurement management'],
    meter: ['Flow meter verification', 'annually, against the NFPA 25 flow test or a reference meter', 'ISO 4064 / manufacturer calibration interval'],
    none: ['No scheduled task', 'connector symbol — the task belongs to the sheet it links to', 'n/a']
  };

  /* AD2: the class table. live = extra rows after the sheet's own state rows; cap = CAPACITY; al = configured alarm
     points (declared limits, shown under ALARMS beside the active events); tr = trend; g = operator guidance. */
  var CLASSES = {
    /* chiller plant */
    'chiller:chillerWater': { name: 'Water-cooled centrifugal chiller', role: 'Rejects data-hall heat from the chilled-water loop to the condenser loop',
      live: [SB('CHW supply', 'cooling.chws_c', 0.15, 1), SB('CHW return', 'cooling.chwr_c', 0.25, 1), S('Compressor current', 'A', 410, 18, 0), S('Evaporator approach', 'K', 1.4, 0.2, 1)],
      cap: [B('Rated capacity', 'cooling.chiller_unit_kw_th', 0), B('Input power per machine', 'cooling.chiller_input_per_machine_kw_e', 1), B('Plant part load', 'cooling.chiller_part_load_pct', 1), B('Running', 'cooling.chillers_running', 0), B('Installed', 'cooling.chillers_total', 0), B('Redundancy', 'cooling.chiller_redundancy'), B('Specific power', 'cooling.chiller_specific_power_kw_e_per_kw_th', 3)],
      al: [D('High CHW supply', 'supply > setpoint + 1.5 K for 60 s'), D('Low evaporator refrigerant temperature', 'trip below 1.0 °C saturated (freeze protection)'), D('Condenser flow loss', 'flow switch open 10 s → trip')],
      tr: { label: 'CHW supply', id: 'cooling.chws_c', amp: 0.15, digits: 1 }, m: 'a180chiller',
      g: 'Keep CHW supply on setpoint; a rising approach means fouled tubes or low refrigerant charge. Stage the standby machine before a running unit exceeds 90 % load.' },
    'chiller:pumpCentrifugal': { name: 'Chilled-water pump', role: 'Moves chilled water through its chiller (primary) or to the data-hall coils (secondary)',
      live: [S('Speed', '%', 78, 4, 0), S('Motor current', 'A', 96, 5, 0), S('Differential head', 'kPa', 245, 9, 0), S('Vibration (ISO 10816)', 'mm/s', 1.8, 0.3, 1)],
      cap: [B('Loop ΔT (design)', 'cooling.chw_delta_t', 1), B('Chiller duty served', 'cooling.chiller_unit_kw_th', 0), D('Arrangement', 'duty / standby per chiller'), D('Permissive', 'suction valve open + no VFD fault')],
      al: [D('Command / feedback mismatch', 'run command without run feedback for 10 s'), D('High vibration', '> 4.5 mm/s (ISO 10816 zone C)'), D('VFD trip', 'drive fault input')],
      /* Amendment E2 (engine 2.10.0): the trend anchors on the operating dp of the pump's own loop, picked by its sheet class */
      tr: { label: 'Differential head', id: 'cooling.chw_primary_pump_dp_op_kpa', amp: 3, digits: 0 }, m: 'a180pump',
      trBy: { 'chw-sec': 'cooling.chw_secondary_pump_dp_op_kpa' },
      g: 'A command without feedback means the motor did not start: check the VFD and the standby takes over. Rising vibration at steady speed points to bearing wear or cavitation.' },
    'chiller:instField': { name: 'Temperature transmitter', role: 'Measures loop water temperature for control and alarms',
      live: [SB('Process value', 'cooling.chws_c', 0.15, 1), D('Range', '0–50 °C, 4–20 mA'), D('Signal quality', 'good (simulated loop)')],
      cap: [B('CHW supply setpoint basis', 'cooling.chws_c', 1), B('CHW return basis', 'cooling.chwr_c', 1), B('Design ΔT', 'cooling.chw_delta_t', 1)],
      al: [D('Out of range', 'signal < 3.8 mA or > 20.5 mA → BAD quality'), D('Rate of change', '> 2 K/min → suspect')],
      tr: { label: 'Process value', id: 'cooling.chws_c', amp: 0.15, digits: 1 }, m: 'cal',
      g: 'A transmitter reading BAD removes its loop from automatic control. Compare with the paired supply/return transmitter before trusting a sudden step.' },
    'chiller:tankExpansion': { name: 'Expansion tank', role: 'Absorbs the thermal expansion of the chilled-water loop and holds system fill pressure',
      live: [S('System pressure', 'bar', 3.2, 0.05, 2), S('Pre-charge', 'bar', 2.5, 0.01, 2), S('Acceptance volume used', '%', 41, 3, 0)],
      cap: [D('Vessel', 'diaphragm type, sized for the loop volume'), B('Loop supply basis', 'cooling.chws_c', 1), B('Loop return basis', 'cooling.chwr_c', 1)],
      al: [D('Low system pressure', '< 2.0 bar → make-up fill'), D('High system pressure', '> 5.5 bar (relief valve 6 bar)')],
      tr: { label: 'System pressure', unit: 'bar', base: 3.2, amp: 0.05, digits: 2 }, m: 'a180tank',
      g: 'Falling pressure with no fill demand means a leak or a lost pre-charge. Recharge the air side with the loop isolated.' },
    'chiller:coolingCoil': { name: 'CRAH cooling coil (hall group)', role: 'Transfers data-hall heat into the chilled-water loop',
      live: [SB('Supply air', 'cooling.crah_supply_air_c', 0.2, 1), SB('Return air', 'cooling.crah_return_air_c', 0.4, 1), S('Valve position', '%', 64, 5, 0)],
      cap: [B('Unit sensible capacity', 'cooling.crah_unit_sensible_kw', 0), B('Units running', 'cooling.crah_running', 0), B('Units required', 'cooling.crah_required', 0), B('Units installed', 'cooling.crah_installed', 0), B('Coil approach', 'cooling.chw_coil_approach_k', 1)],
      al: [D('High supply air', '> rack inlet target + 2 K'), D('Valve saturated', '100 % open for 5 min')],
      tr: { label: 'Supply air', id: 'cooling.crah_supply_air_c', amp: 0.2, digits: 1 }, m: 'a180coil',
      g: 'A valve pinned at 100 % with warm supply air means the coil is short of chilled water: check the secondary pump head and the balancing valve.' },
    /* condenser water and cooling towers (CH-M-102, PRD-CONV-EQUIPMENT-TRUTH E3) */
    'condenser:coolingTowerCell': { name: 'Cooling tower cell (induced draft)', role: 'Rejects the condenser heat of one chiller train to atmosphere by evaporation',
      live: [SB('CDW in (hot)', 'cooling.cdw_return_c', 0.2, 1), SB('CDW out (basin)', 'cooling.cdw_supply_c', 0.15, 1), S('Basin level', '%', 72, 2, 0), S('Fan vibration', 'mm/s', 2.1, 0.3, 1)],
      cap: [B('Heat rejected per cell', 'cooling.tower_cell_rejection_kw_th', 0), B('Cell rating', 'cooling.tower_cell_rated_kw_th', 0), B('Cells running', 'cooling.tower_cells_running', 0), B('Cells installed', 'cooling.tower_cell_count', 0), B('Approach', 'cooling.tower_approach_k', 1), B('Design wet-bulb', 'cooling.tower_design_wet_bulb_c', 1), B('Fan motor', 'cooling.tower_fan_motor_kw', 0)],
      al: [D('High basin outlet temperature', 'CDW supply > design + 1.5 K for 5 min'), D('Fan vibration', 'vibration switch trip'), D('Low basin level', 'make-up valve fails to restore level in 10 min')],
      tr: { label: 'CDW out (basin)', id: 'cooling.cdw_supply_c', amp: 0.15, digits: 1 }, m: 'a180coil',
      g: 'A rising approach at steady load means fouled fill or poor air flow: check the fan, the louvres and the distribution nozzles. Stage another cell before the running cells pass 95 % fan speed.' },
    'condenser:pumpCentrifugal': { name: 'Condenser-water pump', role: 'Moves condenser water from the tower basins through one chiller condenser',
      live: [S('Speed', '%', 100, 2, 0), S('Motor current', 'A', 142, 5, 0), S('Differential head', 'kPa', 245, 9, 0), S('Vibration (ISO 10816)', 'mm/s', 1.9, 0.3, 1)],
      cap: [B('Flow per pump', 'cooling.cdw_pump_flow_lps', 1), B('Motor input', 'cooling.cdw_pump_kw_e', 1), B('Operating head', 'cooling.cdw_pump_head_op_m', 1), B('Design head', 'cooling.cdw_head_m', 0), B('Pumps running', 'cooling.cdw_pumps_running', 0), B('Pumps installed', 'cooling.cdw_pump_count', 0), B('Condenser range', 'cooling.cdw_range_k', 1)],
      al: [D('Command / feedback mismatch', 'run command without run feedback for 10 s'), D('Condenser flow loss', 'flow switch open 10 s → chiller trip'), D('High vibration', '> 4.5 mm/s (ISO 10816 zone C)')],
      tr: { label: 'Differential head', id: 'cooling.cdw_pump_dp_op_kpa', amp: 9, digits: 0 }, m: 'a180pump',
      g: 'A condenser pump that stops trips its chiller on flow loss: start the standby train before stopping a running pump.' },
    'condenser:instField': { name: 'Temperature transmitter', role: 'Measures condenser-water temperature for tower fan and bypass control',
      live: [SB('Process value', 'cooling.cdw_supply_c', 0.15, 1), D('Range', '0–60 °C, 4–20 mA'), D('Signal quality', 'good (simulated loop)')],
      cap: [B('CDW supply basis', 'cooling.cdw_supply_c', 1), B('CDW return basis', 'cooling.cdw_return_c', 1), B('Condenser range', 'cooling.cdw_range_k', 1)],
      al: [D('Out of range', 'signal < 3.8 mA or > 20.5 mA → BAD quality'), D('High CDW supply', '> design + 1.5 K → stage a cell')],
      tr: { label: 'Process value', id: 'cooling.cdw_supply_c', amp: 0.15, digits: 1 }, m: 'cal',
      g: 'CDW supply above design raises every chiller lift: check that the running cells match the running chillers before adjusting setpoints.' },
    /* engine 2.8.0 (PRD-CONV-OPS-DEPTH 01 P3): TV-01, the tower 3-way bypass; every live row is an engine value */
    'condenser:valve3WayMotor': { name: 'Tower bypass valve (3-way, TV-01)', role: 'Sends part of the condenser return past the cells so the chillers never see water colder than their minimum',
      live: [B('Port B (bypass)', 'cooling.cdw_bypass_x_pct', 1), B('Entering condenser water', 'cooling.cdw_entering_c', 1), B('Tower leaving water', 'cooling.cdw_supply_c', 1), B('Condenser return', 'cooling.cdw_return_c', 1)],
      cap: [B('Chiller minimum ECWT', 'cooling.chiller_min_ecwt_c', 1), B('Bypass design flow', 'cooling.cdw_bypass_design_flow_lps', 1), D('Fail position', 'port A open (all water to the cells)')],
      al: [D('Low entering condenser water', '< chiller minimum ECWT'), D('Position deviation', 'command and feedback disagree > 10 % for 60 s')],
      tr: { label: 'Port B (bypass)', id: 'cooling.cdw_bypass_x_pct', amp: 0, digits: 1 }, m: 'a180valve',
      g: 'Bypass open on a warm day means the wet bulb or the approach reading is wrong: the valve should sit at port A unless the towers run cold.' },
    /* fire */
    'fire:pumpCentrifugal': { name: 'Fire pump', role: 'Pressurises the sprinkler and pre-action risers on demand',
      live: [S('Discharge pressure', 'bar', 9.8, 0.2, 1), S('Suction pressure', 'bar', 1.4, 0.05, 2), S('Driver current', 'A', 0, 0, 0)],
      cap: [B('Design demand', 'fire.pump_demand_lpm', 0), B('Static pressure', 'fire.static_pressure_bar', 1), B('Required duration', 'fire.required_duration_min', 0), D('Arrangement', 'main + standby + jockey')],
      al: [D('Pump running', 'any start → supervisory at the FACP'), D('Fail to start', 'start demand without run feedback 10 s'), D('Low suction', '< 0.7 bar')],
      tr: { label: 'Discharge pressure', unit: 'bar', base: 9.8, amp: 0.2, digits: 1 }, m: 'nfpa25pump',
      g: 'A fire pump is never stopped automatically: it runs until reset at the controller. A jockey that cycles more than twice an hour signals a system leak.' },
    'fire:tankStorage': { name: 'Fire water storage tank', role: 'Holds the dedicated fire water reserve',
      live: [B('Level', 'fire.level_pct', 0), B('Stored volume', 'fire.stored_m3', 1), B('Duration at full demand', 'fire.duration_at_full_min', 1)],
      cap: [B('Required capacity', 'fire.required_capacity_m3', 0), B('Reserve capacity', 'fire.reserve_capacity_m3', 0), B('Shortfall', 'fire.capacity_shortfall_m3', 0), B('Required duration', 'fire.required_duration_min', 0), B('Duration available', 'fire.duration_min', 0)],
      al: [D('Low level', '< 90 % → supervisory'), D('Low-low level', '< 75 % → trouble, refill')],
      tr: { label: 'Level', id: 'fire.level_pct', amp: 0.4, digits: 0 }, m: 'nfpa25tank',
      g: 'Stored water below the required capacity is an impairment: notify the authority having jurisdiction and refill before returning to normal.' },
    'fire:instField': { name: 'Fire transmitter', role: 'Measures tank level or riser pressure for the FACP',
      live: [B('Static pressure', 'fire.static_pressure_bar', 1), B('Tank level', 'fire.level_pct', 0), D('Signal quality', 'good (simulated loop)')],
      cap: [B('Static pressure basis', 'fire.static_pressure_bar', 1), B('Stored volume basis', 'fire.stored_m3', 1), D('Range', '0–16 bar or 0–100 %, 4–20 mA')],
      al: [D('Out of range', 'signal < 3.8 mA or > 20.5 mA → trouble'), D('Low pressure', '< 80 % static → jockey start')],
      tr: { label: 'Static pressure', id: 'fire.static_pressure_bar', amp: 0.05, digits: 1 }, m: 'cal',
      g: 'A pressure that decays slowly with the jockey cycling points to a leak; a step drop with flow is a sprinkler or test valve.' },
    facp: { name: 'Fire alarm control panel', role: 'Receives detection, supervises the release circuit and reports every fire event',
      live: [B('Zones supervised', 'fire.zone_count', 0), D('Primary supply', 'mains present'), S('Battery voltage', 'V', 27.2, 0.1, 1)],
      cap: [B('Zones', 'fire.zone_count', 0), D('Standby battery', '24 h standby + 5 min alarm'), D('Release logic', 'cross-zoned: two detectors confirm before release')],
      al: [D('Fire', 'any confirmed zone'), D('Supervisory', 'valve tamper, low air, pump running'), D('Trouble', 'open circuit, earth fault, battery low')],
      tr: { label: 'Battery voltage', unit: 'V', base: 27.2, amp: 0.1, digits: 1 }, m: 'nfpa72facp',
      g: 'Silence is not reset: a silenced alarm still holds the release sequence until the zone clears and the panel is reset.' },
    aspirating: { name: 'Aspirating smoke detector', role: 'Samples air from the hall for very early smoke warning',
      live: [S('Obscuration', '%/m', 0.004, 0.002, 3), S('Airflow', '%', 100, 3, 0), D('Alarm stage', 'Alert / Action / Fire 1 / Fire 2')],
      cap: [D('Sampling holes', 'per pipe network design'), D('Transport time', '<= 120 s (NFPA 72 maximum)'), B('Zones in plant', 'fire.zone_count', 0)],
      al: [D('Alert', '0.05 %/m'), D('Fire 1', '0.20 %/m'), D('Airflow fault', '± 20 % of commissioned flow')],
      tr: { label: 'Obscuration', unit: '%/m', base: 0.004, amp: 0.002, digits: 3 }, m: 'nfpa72asd',
      g: 'An Alert is a reason to look, not to evacuate: walk the sampled area. An airflow fault means the detector is blind — treat the zone as impaired.' },
    releasePanel: { name: 'Release control panel', role: 'Drives the pre-action solenoids once the FACP confirms two detectors',
      live: [D('Release circuit', 'supervised, not active'), D('Solenoid', 'de-energised'), S('Circuit current', 'mA', 12, 0.5, 1)],
      cap: [B('Zones released', 'fire.zone_count', 0), D('Delay', '30 s pre-discharge delay'), D('Abort', 'abort switch holds the timer')],
      al: [D('Release', 'release output active'), D('Circuit open', 'supervision current < 5 mA')],
      tr: { label: 'Circuit current', unit: 'mA', base: 12, amp: 0.5, digits: 1 }, m: 'nfpa72facp',
      g: 'An open release circuit is an impairment of the suppression: fix before the next shift.' },
    manualStation: { name: 'Manual release station', role: 'Lets a person release the system by hand',
      live: [D('Contact', 'normal'), D('Cover', 'in place'), S('Line current', 'mA', 4.1, 0.1, 1)],
      cap: [D('Action', 'single action, releases without delay'), B('Zones covered', 'fire.zone_count', 0), D('Mounting', 'at exit, 1.1–1.4 m')],
      al: [D('Operated', 'contact closed'), D('Line fault', 'open or short')],
      tr: { label: 'Line current', unit: 'mA', base: 4.1, amp: 0.1, digits: 1 }, m: 'nfpa72init',
      g: 'Manual release bypasses cross-zoning: operate only when fire is confirmed by sight.' },
    abortSwitch: { name: 'Abort switch', role: 'Holds the release timer while pressed',
      live: [D('Contact', 'normal'), D('Hold mode', 'dead-man (held)'), S('Line current', 'mA', 4.0, 0.1, 1)],
      cap: [D('Effect', 'holds the countdown, never cancels the alarm'), B('Zones covered', 'fire.zone_count', 0), D('Reset', 'timer restarts on release')],
      al: [D('Abort active', 'contact held'), D('Line fault', 'open or short')],
      tr: { label: 'Line current', unit: 'mA', base: 4.0, amp: 0.1, digits: 1 }, m: 'nfpa72init',
      g: 'Hold the abort only while the cause is checked; the alarm stays active.' },
    compressor: { name: 'Nitrogen generator / compressor', role: 'Keeps the pre-action piping supervised under nitrogen',
      live: [S('Supervisory pressure', 'bar', 2.4, 0.05, 2), S('N2 purity', '%', 98.2, 0.2, 1), S('Run hours today', 'h', 1.2, 0.2, 1)],
      cap: [D('Purity target', '>= 98 % N2 (corrosion control)'), D('Fill time', 'system to pressure in <= 30 min'), B('Zones supplied', 'fire.zone_count', 0)],
      al: [D('Low supervisory pressure', '< 1.7 bar'), D('High pressure', '> 3.1 bar'), D('Low purity', '< 95 %')],
      tr: { label: 'Supervisory pressure', unit: 'bar', base: 2.4, amp: 0.05, digits: 2 }, m: 'nfpa25air',
      g: 'Falling supervisory pressure on a pre-action zone means a leak or an opened head: find it before the zone is called on.' },
    'fire:valveCheck': { name: 'Check valve', role: 'Stops back-flow into the pump or the mains', live: [D('Position', 'closed (no flow)'), D('Differential', 'not measured')],
      cap: [B('Design flow', 'fire.pump_demand_lpm', 0), B('Static pressure', 'fire.static_pressure_bar', 1)], al: [D('Supervision', 'none (passive device)')], m: 'nfpa25check',
      g: 'A check valve that leaks back lets the jockey cycle; listen for chatter after a pump stop.' },
    valveGate: { name: 'Isolation (control) valve', role: 'Isolates a section of the fire main; supervised open',
      live: [D('Position', 'open, tamper switch normal'), D('Supervision', 'electrical tamper to FACP')],
      cap: [B('Design flow', 'fire.pump_demand_lpm', 0), B('Static pressure', 'fire.static_pressure_bar', 1), D('Normal position', 'locked open')],
      al: [D('Tamper', 'valve off fully-open → supervisory')], m: 'nfpa25valveCtl',
      g: 'A closed control valve is the most common cause of a failed sprinkler system: any tamper signal is investigated at once.' },
    valveGlobe: { name: 'Test valve', role: 'Inspector’s test / main drain path', live: [D('Position', 'closed'), D('Use', 'flow test and main drain test')],
      cap: [B('Static pressure', 'fire.static_pressure_bar', 1), D('Test', 'residual pressure recorded against static')], al: [D('Supervision', 'none')], m: 'nfpa25alarm',
      g: 'Record static and residual pressure at every main drain test: a falling residual over the years means a blocked supply.' },
    drain: { name: 'Drain', role: 'Drains the riser for test and maintenance', live: [D('Position', 'closed'), D('Discharge', 'to drain sump')],
      cap: [D('Sized for', 'full riser drain'), B('Static pressure', 'fire.static_pressure_bar', 1)], al: [D('Supervision', 'none')], m: 'nfpa25alarm',
      g: 'Close and confirm the drain after a test; an open drain is an impairment.' },
    flowMeter: { name: 'Flow meter', role: 'Measures flow for the pump test or the make-up line',
      live: [S('Flow', 'L/min', 0, 0, 0), D('Totaliser', 'not reset this period'), D('Signal quality', 'good (simulated loop)')],
      cap: [B('Design pump demand', 'fire.pump_demand_lpm', 0), D('Range', '0–150 % of pump rating')], al: [D('Flow with no demand', 'flow > 5 % while no pump runs')], m: 'meter',
      g: 'Flow with no pump running means a head, a test valve or a leak is open.' },
    alarmValve: { name: 'Wet alarm valve', role: 'Signals water flow into a wet sprinkler zone',
      live: [D('Clapper', 'closed'), D('Pressure switch', 'normal'), S('Trim pressure', 'bar', 8.9, 0.1, 1)],
      cap: [B('Static pressure', 'fire.static_pressure_bar', 1), B('Design demand', 'fire.pump_demand_lpm', 0)],
      al: [D('Water flow', 'pressure switch closed 30 s → fire alarm'), D('Tamper', 'trim valve closed')],
      tr: { label: 'Trim pressure', unit: 'bar', base: 8.9, amp: 0.1, digits: 1 }, m: 'nfpa25alarm',
      g: 'A water-flow alarm is a fire alarm until proved otherwise.' },
    preActionValve: { name: 'Pre-action valve', role: 'Keeps the hall piping dry until detection and release both occur',
      live: [D('Valve', 'set (closed)'), S('Priming pressure', 'bar', 8.7, 0.1, 1), S('System (N2) pressure', 'bar', 2.4, 0.05, 2)],
      cap: [B('Zones', 'fire.zone_count', 0), D('Interlock', 'double interlock: detection AND pressure loss'), B('Design demand', 'fire.pump_demand_lpm', 0)],
      al: [D('Valve tripped', 'clapper open'), D('Low air', 'system pressure < 1.7 bar')],
      tr: { label: 'System (N2) pressure', unit: 'bar', base: 2.4, amp: 0.05, digits: 2 }, m: 'nfpa25preact',
      g: 'Double interlock means water enters the piping only after detection AND a head opening: a low-air alarm alone does not trip it.' },
    sprinklerHead: { name: 'Sprinkler head (zone)', role: 'Discharges water when its bulb reaches temperature',
      live: [D('State', 'closed'), D('Bulb rating', '68 °C'), D('Response', 'quick response')],
      cap: [B('Design demand', 'fire.pump_demand_lpm', 0), B('Required duration', 'fire.required_duration_min', 0)],
      al: [D('Operated', 'reported by the flow switch of its zone')], m: 'nfpa25spr',
      g: 'Never paint, cover or load a sprinkler; replace any head with corrosion or a cracked bulb.' },
    smokeDetector: { name: 'Smoke detector (zone)', role: 'Confirms fire for cross-zoned release',
      live: [S('Obscuration', '%/ft', 0.2, 0.05, 2), D('Sensitivity', 'within listed range'), D('Line', 'normal')],
      cap: [B('Zones', 'fire.zone_count', 0), D('Cross-zoning', 'two detectors confirm before release')],
      al: [D('Alarm', 'above listed sensitivity'), D('Dirty', 'drift compensation exhausted')],
      tr: { label: 'Obscuration', unit: '%/ft', base: 0.2, amp: 0.05, digits: 2 }, m: 'nfpa72det',
      g: 'One detector in alarm starts the pre-discharge warning; release needs the second.' },
    /* fuel */
    'fuel:tankStorage': { name: 'Fuel tank', role: 'Stores diesel for the standby generators',
      live: [B('Level', 'fuel.level_pct', 0), B('Usable volume', 'fuel.usable_l', 0), B('Autonomy', 'fuel.autonomy_hr', 0)],
      cap: [B('Tank capacity', 'fuel.tank_capacity_l', 0), B('Usable fraction', 'fuel.usable_fraction', 2), B('Fleet burn', 'fuel.generator_consumption_lph', 0), B('Specific consumption', 'fuel.specific_consumption_l_per_kwh', 3)],
      al: [B('Low level', 'fuel.level_low_pct', 0), B('Low-low level', 'fuel.level_low_low_pct', 0), B('Overfill', 'fuel.level_overfill_pct', 0)],
      tr: { label: 'Level', id: 'fuel.level_pct', amp: 0.3, digits: 0 }, m: 'nfpa110fuel',
      g: 'Order fuel at the low level; at low-low the autonomy no longer covers the contracted delivery time.' },
    'fuel:pumpCentrifugal': { name: 'Fuel transfer pump', role: 'Lifts diesel from the bulk tank to the day tanks',
      live: [S('Discharge pressure', 'bar', 2.1, 0.05, 2), S('Motor current', 'A', 7.4, 0.3, 1), D('Mode', 'duty / standby alternate weekly')],
      cap: [B('Fleet burn to replace', 'fuel.generator_consumption_lph', 0), D('Rule', 'pump flow >= 1.25 × fleet burn (plan E-1)')],
      al: [D('Fail to start', 'command without flow 15 s'), D('Run dry', 'suction pressure low')],
      tr: { label: 'Discharge pressure', unit: 'bar', base: 2.1, amp: 0.05, digits: 2 }, m: 'nfpa110gen',
      g: 'If both transfer pumps fail the day tanks set the autonomy: start manual transfer before the day tank low alarm.' },
    'fuel:instField': { name: 'Fuel pressure transmitter', role: 'Measures transfer header pressure',
      live: [S('Header pressure', 'bar', 2.0, 0.05, 2), D('Range', '0–6 bar, 4–20 mA'), D('Signal quality', 'good (simulated loop)')],
      cap: [B('Fleet burn', 'fuel.generator_consumption_lph', 0), D('Normal band', '1.5–2.5 bar')], al: [D('Low header pressure', '< 1.0 bar with a pump running')],
      tr: { label: 'Header pressure', unit: 'bar', base: 2.0, amp: 0.05, digits: 2 }, m: 'cal',
      g: 'Low pressure with a pump running: a clogged filter or air in the suction.' },
    'fuel:flowMeter': { name: 'Fuel flow meter', role: 'Measures transfer flow and totalises deliveries',
      live: [S('Flow', 'L/h', 0, 0, 0), D('Totaliser', 'not reset this period'), D('Signal quality', 'good (simulated loop)')],
      cap: [B('Fleet burn', 'fuel.generator_consumption_lph', 0), B('Tank capacity', 'fuel.tank_capacity_l', 0)], al: [D('Flow with no pump', 'flow > 0 with both pumps stopped')], m: 'meter',
      g: 'Flow with both pumps stopped means siphoning or a leak.' },
    leakSensor: { name: 'Leak sensor', role: 'Detects fuel in a tank interstice or a sump',
      live: [D('State', 'dry'), D('Sensor', 'float + hydrocarbon'), S('Loop current', 'mA', 4.0, 0.05, 1)],
      cap: [B('Tank capacity', 'fuel.tank_capacity_l', 0), D('Containment', 'double wall / bunded')], al: [D('Leak', 'liquid detected → alarm + stop transfer'), D('Sensor fault', 'open loop')],
      tr: { label: 'Loop current', unit: 'mA', base: 4.0, amp: 0.05, digits: 1 }, m: 'ust',
      g: 'A leak alarm stops transfer automatically; inspect before restoring.' },
    'fuel:filterCartridge': { name: 'Fuel filter / polisher', role: 'Removes water and particulates from the fuel',
      live: [S('Differential pressure', 'kPa', 18, 1.5, 0), D('Water bowl', 'dry'), D('Stage', 'per tag: pre-filter, coalescer, fine filter')],
      cap: [B('Fleet burn', 'fuel.generator_consumption_lph', 0), D('Change at', 'ΔP 70 kPa')], al: [D('High ΔP', '> 70 kPa'), D('Water in bowl', 'water sensor wet')],
      tr: { label: 'Differential pressure', unit: 'kPa', base: 18, amp: 1.5, digits: 0 }, m: 'nfpa110filter',
      g: 'Water in diesel feeds microbial growth: drain the bowl and test the bulk tank.' },
    valveSolenoid: { name: 'Solenoid valve', role: 'Opens a line on command (fill, blowdown, backwash)',
      live: [D('Command', 'per sheet state'), D('Coil', 'supervised'), D('Fail position', 'closed (de-energised)')],
      cap: [D('Duty', 'on/off, fail closed'), D('Response', '< 1 s')], al: [D('Position mismatch', 'command and feedback disagree 5 s')], m: 'a180valve',
      g: 'A fail-closed valve that will not open stops the line: check the coil supply before the valve.' },
    gensetDiesel: { name: 'Diesel generator set', role: 'Carries the facility on loss of utility power',
      live: [S('Coolant temperature (standby heater)', '°C', 42, 1, 0), S('Battery voltage', 'V', 26.8, 0.1, 1), D('Mode', 'AUTO, ready')],
      cap: [B('Fleet fuel burn', 'fuel.generator_consumption_lph', 0), B('Specific consumption', 'fuel.specific_consumption_l_per_kwh', 3), B('Fleet autonomy', 'fuel.autonomy_hr', 0), D('Fleet sizing', 'under review — audit E-C1 (plan W4)')],
      al: [D('Fail to start', 'no voltage 10 s after crank'), D('Low coolant temperature', '< 30 °C (heater failed)'), D('Low battery', '< 24 V')],
      tr: { label: 'Battery voltage', unit: 'V', base: 26.8, amp: 0.1, digits: 1 }, m: 'nfpa110gen',
      g: 'A cold block or a weak battery is the commonest failure to start: both are checked at the weekly inspection.' },
    /* water */
    'water:tankStorage': { name: 'Water tank', role: 'Buffers raw or domestic water for the plant',
      live: [S('Level', '%', 78, 2, 0), S('Volume', 'm³', 312, 8, 0), D('Inlet', 'per sheet state')],
      cap: [B('Treated demand', 'water.total_treated_lpm', 0), B('Domestic demand', 'water.domestic_lpm', 0)], al: [D('Low level', '< 40 %'), D('High level', '> 95 %')],
      tr: { label: 'Level', unit: '%', base: 78, amp: 2, digits: 0 }, m: 'water',
      g: 'A falling level with the inlet open means the make-up cannot keep up: check the mains pressure.' },
    'water:pumpCentrifugal': { name: 'Booster pump', role: 'Pressurises treated water to the tower make-up and services',
      live: [S('Speed', '%', 72, 4, 0), S('Discharge pressure', 'bar', 4.1, 0.1, 1), S('Motor current', 'A', 22, 1, 0)],
      cap: [B('Treated flow', 'water.total_treated_lpm', 0), B('Tower make-up flow', 'water.flow_lpm_for_wue', 0), D('Arrangement', 'duty / standby')],
      al: [D('Fail to start', 'command without feedback 10 s'), D('Low discharge', '< 2.5 bar')],
      tr: { label: 'Discharge pressure', unit: 'bar', base: 4.1, amp: 0.1, digits: 1 }, m: 'a180pump',
      g: 'Make-up loss stops the towers within hours: the standby must start on a duty fault.' },
    'water:instField': { name: 'Water transmitter', role: 'Measures tank level or line pressure',
      live: [S('Process value', '%', 78, 2, 0), D('Range', '4–20 mA'), D('Signal quality', 'good (simulated loop)')],
      cap: [B('Treated demand', 'water.total_treated_lpm', 0)], al: [D('Out of range', 'signal < 3.8 mA or > 20.5 mA')],
      tr: { label: 'Process value', unit: '%', base: 78, amp: 2, digits: 0 }, m: 'cal',
      g: 'Cross-check a level transmitter against the sight glass before acting on it.' },
    'water:flowMeter': { name: 'Water meter', role: 'Measures site intake or tower make-up',
      live: [SB('Flow', 'water.total_treated_lpm', 6, 0), D('Totaliser', 'not reset this period'), D('Signal quality', 'good (simulated loop)')],
      cap: [B('Treated flow (engine)', 'water.total_treated_lpm', 0), B('WUE (engine)', 'water.wue_l_per_kwh', 2), B('WUE target', 'water.wue_target_l_per_kwh', 2)],
      al: [D('High flow', '> 120 % of design for 15 min')], tr: { label: 'Flow', id: 'water.total_treated_lpm', amp: 6, digits: 0 }, m: 'meter',
      g: 'A step up in make-up with steady load means a tower overflow or a stuck blowdown valve.' },
    'water:filterCartridge': { name: 'Media filter', role: 'Removes suspended solids before treatment',
      live: [S('Differential pressure', 'kPa', 35, 3, 0), D('Mode', 'service'), S('Turbidity out', 'NTU', 0.6, 0.1, 1)],
      cap: [B('Treated flow', 'water.total_treated_lpm', 0), D('Backwash at', 'ΔP 80 kPa')], al: [D('High ΔP', '> 80 kPa → backwash'), D('High turbidity', '> 1 NTU')],
      tr: { label: 'Differential pressure', unit: 'kPa', base: 35, amp: 3, digits: 0 }, m: 'water',
      g: 'Backwash on ΔP, not on a timer: an early backwash wastes water.' },
    dosingPot: { name: 'Dosing pot', role: 'Adds treatment chemical to the closed / make-up water',
      live: [S('Conductivity', 'µS/cm', 1450, 40, 0), S('pH', '', 8.2, 0.05, 1), D('Charge', 'per water treatment program')],
      cap: [B('Cycles of concentration', 'water.tower_cycles_of_concentration', 0), B('Blowdown', 'water.blowdown_lpm', 1)], al: [D('High conductivity', '> 1,800 µS/cm → blowdown'), D('pH out of band', '< 7.5 or > 9.0')],
      tr: { label: 'Conductivity', unit: 'µS/cm', base: 1450, amp: 40, digits: 0 }, m: 'water',
      g: 'Conductivity sets the blowdown: more cycles save water but raise the scaling risk.' },
    uvSteriliser: { name: 'UV steriliser', role: 'Disinfects the domestic water',
      live: [S('UV intensity', '%', 88, 1.5, 0), S('Lamp hours', 'h', 5210, 0, 0), D('Lamp', 'on')],
      cap: [B('Domestic flow', 'water.domestic_lpm', 0), D('Dose', '>= 40 mJ/cm² at end of lamp life')], al: [D('Low intensity', '< 70 %'), D('Lamp failure', 'lamp current zero')],
      tr: { label: 'UV intensity', unit: '%', base: 88, amp: 1.5, digits: 0 }, m: 'uv',
      g: 'Low intensity means a dirty sleeve or an aged lamp: water passing is not disinfected.' },
    valveControlMotor: { name: 'Motorised control valve', role: 'Modulates tower make-up on basin level',
      live: [S('Position', '%', 46, 5, 0), D('Mode', 'auto'), D('Feedback', 'potentiometer')],
      cap: [B('Make-up flow basis', 'water.flow_lpm_for_wue', 0), D('Action', 'fail last position')], al: [D('Position deviation', '> 10 % for 60 s')],
      tr: { label: 'Position', unit: '%', base: 46, amp: 5, digits: 0 }, m: 'a180valve',
      g: 'A valve pinned open with a high basin level means the level sensor or the valve has failed.' },
    coolingTowerCell: { name: 'Cooling tower (make-up point)', role: 'Rejects condenser heat by evaporation; make-up replaces evaporation, blowdown and drift',
      live: [B('Evaporation', 'water.evaporation_lpm', 1), B('Blowdown', 'water.blowdown_lpm', 1), B('Drift', 'water.drift_lpm', 1)],
      cap: [B('Tower heat rejection', 'cooling.tower_rejection_kw_th', 0), B('Cycles of concentration', 'water.tower_cycles_of_concentration', 0), B('Drift fraction', 'water.tower_drift_fraction', 3), B('Make-up for WUE', 'water.flow_lpm_for_wue', 0), B('WUE', 'water.wue_l_per_kwh', 2)],
      al: [D('Low basin level', '< 30 %'), D('High conductivity', '> blowdown setpoint')],
      tr: { label: 'Evaporation', id: 'water.evaporation_lpm', amp: 8, digits: 0 }, m: 'a188tower',
      g: 'Make-up = evaporation + blowdown + drift: if make-up rises with no load change, look for an overflow.' },
    hxShellTube: { name: 'Heat exchanger (to chiller plant)', role: 'Couples the water system to the chiller plant loop',
      live: [SB('Primary in', 'cooling.chwr_c', 0.2, 1), SB('Primary out', 'cooling.chws_c', 0.15, 1), S('Approach', 'K', 1.5, 0.15, 1)],
      cap: [B('Design ΔT', 'cooling.chw_delta_t', 1), B('Tower rejection', 'cooling.tower_rejection_kw_th', 0)], al: [D('High approach', '> 3 K → fouling')],
      tr: { label: 'Approach', unit: 'K', base: 1.5, amp: 0.15, digits: 1 }, m: 'a180hx',
      g: 'A widening approach at steady load is fouling: schedule cleaning before it costs chiller lift.' },
    /* any page */
    instField: { name: 'Field transmitter', role: 'Measures a process value', live: [D('Range', '4–20 mA'), D('Signal quality', 'good (simulated loop)')],
      cap: [D('Accuracy', '± 0.25 % of span')], al: [D('Out of range', 'signal < 3.8 mA or > 20.5 mA')], m: 'cal', g: 'A BAD transmitter removes its loop from automatic control.' },
    pumpCentrifugal: { name: 'Pump', role: 'Moves water through its loop', live: [S('Speed', '%', 75, 4, 0), S('Motor current', 'A', 40, 2, 0)],
      cap: [D('Arrangement', 'duty / standby')], al: [D('Fail to start', 'command without feedback 10 s')], m: 'a180pump', g: 'The standby takes the duty on a fault.' },
    tankStorage: { name: 'Tank', role: 'Stores process fluid', live: [S('Level', '%', 70, 2, 0)], cap: [D('Capacity', 'per vessel datasheet')], al: [D('Low level', '< 40 %')], m: 'water', g: 'Watch the level trend, not one reading.' },
    flowMeter: { name: 'Flow meter', role: 'Measures flow', live: [S('Flow', 'L/min', 0, 0, 0), D('Signal quality', 'good (simulated loop)')], cap: [D('Range', 'per datasheet')], al: [D('High flow', 'per datasheet')], m: 'meter', g: 'Compare the flow with the pump state.' },
    filterCartridge: { name: 'Filter', role: 'Removes particulates', live: [S('Differential pressure', 'kPa', 20, 2, 0)], cap: [D('Change at', 'manufacturer ΔP')], al: [D('High ΔP', 'manufacturer limit')], m: 'a180valve', g: 'Change on ΔP.' },
    valveCheck: { name: 'Check valve', role: 'Stops back-flow', live: [D('Position', 'closed (no flow)'), D('Differential', 'not measured')],
      cap: [D('Type', 'swing / dual-plate, passive')], al: [D('Supervision', 'none (passive device)')], m: 'a180valve', g: 'A leaking check lets the idle pump spin backwards.' },
    valveButterfly: { name: 'Isolation valve', role: 'Isolates its chiller from the header', live: [D('Position', 'per sheet state'), D('Actuator', 'electric, open/close'), D('Fail position', 'last position')],
      cap: [B('Chiller served', 'cooling.chiller_unit_kw_th', 0), D('Type', 'butterfly, lug, PN16')], al: [D('Position mismatch', 'command and feedback disagree 30 s')], m: 'a180valve',
      g: 'Open the isolation valves before starting a chiller: the flow switch blocks the start otherwise.' },
    valveBalancing: { name: 'Decoupler / balancing valve', role: 'Lets primary and secondary flow differ without fighting', live: [D('Position', 'set at commissioning'), D('Flow direction', 'per sheet state')],
      cap: [B('Loop ΔT', 'cooling.chw_delta_t', 1), D('Setting', 'locked at commissioning')], al: [D('Reverse flow', 'secondary flow > primary flow (blending warm return)')], m: 'a180valve',
      g: 'Reverse flow in the decoupler mixes return water into supply: add a primary pump before the hall warms.' },
    airVent: { name: 'Automatic air vent', role: 'Releases trapped air at a high point', live: [D('State', 'closed (no air)'), D('Type', 'float')], cap: [D('Location', 'loop high point')], al: [D('Supervision', 'none')], m: 'a180valve', g: 'Air in the loop shows as pump noise and lost flow.' },
    offSheet: { name: 'Off-sheet connector', role: 'Continues this line on another drawing', live: [D('Continues to', 'see DEPS'), D('Data', 'none on this symbol')], cap: [D('Rating', 'per the connected line')], al: [D('Supervision', 'none')], m: 'none', g: 'Follow the connector to the sheet that owns the line.' },
    junction: null
  };
  delete CLASSES.junction;   /* junctions carry no tag and open nothing */
  CLASSES['fire:flowMeter'] = { name: 'Fire flow meter', role: 'Measures flow for the pump test or the make-up line',
    live: [S('Flow', 'L/min', 0, 0, 0), D('Totaliser', 'not reset this period'), D('Signal quality', 'good (simulated loop)')],
    cap: [B('Design pump demand', 'fire.pump_demand_lpm', 0), D('Range', '0–150 % of pump rating')], al: [D('Flow with no demand', 'flow > 5 % while no pump runs')], m: 'meter',
    g: 'Flow with no pump running means a head, a test valve or a leak is open.' };

  /* E-S-101 HV / MV single-line (EPMS_Telemetry.html, PRD-CONV-LIVING-PLANT §8.1). Ratings are engine values; the
     flows and states are the page's own topology solve (read() rows above these). Protection settings are TRAINING
     values by the engine's grading rule, never a relay study. */
  STD.cb = ['Breaker timing, trip-coil and contact-resistance test', 'per NFPA 70B condition of maintenance (typically 1–3 years); SF6 density monitored continuously', 'NFPA 70B — circuit breakers; IEC 62271-100'];
  STD.ds = ['Disconnector / earthing-switch operation and interlock check', 'operate and verify interlocks annually; inspect per NFPA 70B condition', 'NFPA 70B — switches; IEC 62271-102'];
  STD.tx = ['Transformer oil DGA, insulation and winding tests', 'DGA annually; electrical tests per condition', 'IEEE C57.104 / NFPA 70B — transformers'];
  STD.relay = ['Protection relay secondary-injection test', 'at commissioning, then per the utility / NFPA 70B interval (typically 3–6 years)', 'IEC 60255 / NFPA 70B — protective relays'];
  STD.itx = ['Instrument transformer ratio and burden check', 'with the relay test of the bay', 'IEC 61869 / NFPA 70B'];
  STD.sa = ['Surge arrester leakage-current and counter reading', 'annually', 'IEC 60099-5 practice'];
  var HVR = B('150 kV switchgear rating', 'electrical.hv_switchgear_rated_ka', 0), MVF = B('20 kV fault level', 'electrical.mv_fault_level_ka', 1);
  var EG = 'A breaker or switch is operated only through the simulation button in the inspector; the interlock states any condition that is not met.';
  CLASSES['epms:utilitySource'] = { name: 'PLN 150 kV incoming line', role: 'Brings the utility supply into the GIS line bay through a cable sealing end',
    live: [D('Supply', 'PLN 150 kV, two independent lines'), D('Auto-reclose 79', 'blocked: the incoming circuit is cable')], cap: [B('Voltage', 'electrical.hv_voltage_kv', 0), B('Fault level at the GIS', 'electrical.hv_fault_level_ka', 0), B('Source short-circuit power', 'electrical.hv_source_mva', 0)],
    al: [D('Line voltage lost', 'undervoltage 27 on the line VT')], m: 'none', g: 'Either line carries the whole site through the coupler; a lost line is ridden through without load transfer.' };
  CLASSES['epms:surgeArrester'] = { name: 'Surge arrester', role: 'Clamps switching and lightning surges at the cable sealing end',
    live: [D('Type', 'metal-oxide, station class'), D('Connection', 'phase to earth at the cable sealing end')], cap: [B('System voltage', 'electrical.hv_voltage_kv', 0)], al: [D('Counter step', 'operation counter increments on each discharge')], m: 'sa',
    g: 'Rising leakage current means a degrading arrester; plan its replacement at the next line outage.' };
  CLASSES['epms:voltageTransformer'] = { name: 'Voltage transformer', role: 'Feeds the line voltage to the distance protection, metering and synchro-check',
    live: [D('Secondary', '110 V / sqrt3'), D('Accuracy', 'class 0.2 metering, 3P protection')], cap: [B('Primary voltage', 'electrical.hv_voltage_kv', 0)], al: [D('VT fuse failure', 'blocks distance 21 and alarms')], m: 'itx',
    g: 'A VT supervision alarm blocks the distance element; the line differential 87L still protects the line.' };
  CLASSES['epms:currentTransformer'] = { name: 'Current transformer', role: 'Feeds the bay current to its protection relay and meter',
    live: [D('Cores', 'protection class 5P + metering class 0.2S'), D('Secondary', '1 A')], cap: [MVF, HVR], al: [D('CT open circuit', 'differential supervision alarm')], m: 'itx',
    g: 'Never open a CT secondary under load; short it at the test block first.' };
  CLASSES['epms:disconnector'] = { name: 'Disconnector', role: 'Provides a visible isolation point; it never makes or breaks load current',
    live: [D('Interlock', 'moves only with its breaker open'), D('Operation', 'motor-operated, off-load only')], cap: [HVR, B('System voltage', 'electrical.hv_voltage_kv', 0)], al: [D('Position discrepancy', 'auxiliary contacts disagree for 5 s')], m: 'ds', g: EG };
  CLASSES['epms:earthSwitch'] = { name: 'Earthing switch', role: 'Earths an isolated, dead circuit for safe work',
    live: [D('Interlock', 'closes only with its disconnectors open and the circuit dead'), D('Type', 'maintenance earthing switch, no making capacity')], cap: [HVR], al: [D('Closed on live circuit', 'prevented by interlock')], m: 'ds', g: EG };
  CLASSES['epms:cbIec'] = { name: 'Circuit breaker', role: 'Makes and breaks load and fault current on command of its protection relay',
    live: [D('Operating mechanism', 'spring-charged, motor recharge'), D('Interrupting medium', 'SF6 at 150 kV, vacuum at 20 kV, air at 0.4 kV')], cap: [HVR, MVF, B('LV fault level at the board', 'electrical.lv_fault_level_ka', 1)],
    al: [D('Trip-circuit supervision', 'trip coil continuity lost'), D('Spring not charged', 'closing inhibited')], m: 'cb', g: EG };
  CLASSES['epms:protectionRelay'] = { name: 'Protection relay', role: 'Measures the bay current and trips its breaker on a fault (IEEE C37.2 device numbers)',
    live: [D('Settings', 'TRAINING values by the engine grading rule, not a relay study'), D('Trip path', 'own breaker; 86 lockout where the function locks out')], cap: [B('Grading margin', 'electrical.pro_grading_margin_s', 1), B('TMS step', 'electrical.pro_tms_step', 2)],
    al: [D('Relay healthy', 'watchdog contact opens on self-test failure'), D('Lockout 86', '87T / 87B / 50BF trips lock out until the operator resets')], m: 'relay',
    g: 'Open the time–current curves to see this relay against the devices below and above it.' };
  CLASSES['epms:transformer2w'] = { name: 'Power transformer', role: 'Transforms the supply between voltage levels; each unit is sized to carry its share with one unit lost',
    live: [D('Cooling', 'ONAN / ONAF'), D('Tap changer', 'on-load, HV winding')], cap: [B('Rating (150/20 kV units)', 'electrical.hv_tx_mva', 0), B('Impedance (150/20 kV)', 'electrical.hv_tx_impedance_pct', 1), B('Load, normal', 'electrical.hv_tx_load_pct_normal', 1), B('Load, one unit lost', 'electrical.hv_tx_load_pct_n1', 1), B('Distribution unit rating', 'electrical.dist_tx_kva', 0)],
    al: [D('Buchholz 63', 'gas alarm, then trip'), D('Winding temperature 26/49', 'alarm then trip')], m: 'tx',
    g: 'With one 150/20 kV unit out the other carries the site through the 20 kV bus tie; watch its load against the N-1 figure.' };
  CLASSES['epms:resistor'] = { name: 'Neutral earthing resistor', role: 'Limits the 20 kV earth-fault current at the transformer star point',
    live: [D('Connection', 'transformer 20 kV star point to earth'), D('Duty', 'short-time rated, 10 s')], cap: [B('Resistance', 'electrical.mv_ngr_ohm', 0), B('Earth-fault current', 'electrical.mv_earth_fault_a', 1)],
    al: [D('Standby earth fault 51G', 'trips the 20 kV incomer, then the transformer')], m: 'tx', g: 'The NGR limits an earth fault to a current the feeder earth-fault relays still see.' };
  CLASSES['epms:generatorIec'] = { name: 'Diesel genset block', role: 'Standby generation on the 20 kV generator bus, N+1 per hall',
    live: [D('State', 'off (simulation: gensets are not started on this sheet)'), D('Synchronising', '25 sync-check on the generator bus')], cap: [B('Gensets installed', 'electrical.genset_count', 0), B('Unit rating', 'electrical.genset_unit_kw', 0), B('Gensets per hall', 'electrical.genset_per_hall', 0), B('N-1 margin', 'electrical.genset_n1_margin_pct', 1)],
    al: [D('Fail to start', 'no voltage 10 s after start command')], m: 'nfpa110gen', g: 'The generator incomers close only on a synchronised, running generator bus.' };
  CLASSES['epms:earth'] = { name: 'Earth electrode', role: 'Connects the neutral earthing resistor to the substation earth grid',
    live: [D('Connection', 'substation earth grid'), D('Data', 'none on this symbol')], cap: [B('Earth-fault current it carries', 'electrical.mv_earth_fault_a', 1)],
    al: [D('Supervision', 'earth-grid resistance test, not a live point')], m: 'ds', g: 'The earth path is tested with the grid survey; it carries current only during a 20 kV earth fault.' };
  CLASSES['epms:offSheet'] = { name: 'Off-sheet connection', role: 'Continues this circuit on another drawing (hall ring or LV distribution)',
    live: [D('Continues to', 'see DEPS'), D('Data', 'the load shown is the hall stream share the topology solve carries')], cap: [B('Units per stream per hall', 'electrical.dist_tx_per_stream_per_hall', 0), B('Distribution units on site', 'electrical.dist_tx_count', 0)],
    al: [D('Supervision', 'on the connected drawing')], m: 'none', g: 'Follow the connection to the drawing that owns the circuit.' };

  /* A transmitter on the return header measures the return temperature: same recipe, the other registry anchor. */
  function onReturn(page, n) {
    return n && n.sym === 'instField' && ((page === 'chiller' && /^(tthr|ttr\d)/.test(n.id || '')) || (page === 'condenser' && n.id === 'ttcr'));
  }
  function swapAnchor(spec) {
    var to = { 'cooling.chws_c': 'cooling.chwr_c', 'cooling.cdw_supply_c': 'cooling.cdw_return_c' };
    if (!spec || !to[spec.id] || spec.label !== 'Process value') return spec;
    var out = {}, k;
    for (k in spec) if (Object.prototype.hasOwnProperty.call(spec, k)) out[k] = spec[k];
    out.id = to[spec.id]; out.amp = 0.25;
    return out;
  }
  function classOf(page, sym, n) {
    var cls = CLASSES[page + ':' + sym] || CLASSES[sym] || null, out, k;
    if (cls && cls.trBy && n && cls.trBy[n.cls]) {
      out = {};
      for (k in cls) if (Object.prototype.hasOwnProperty.call(cls, k)) out[k] = cls[k];
      out.tr = { label: cls.tr.label, id: cls.trBy[n.cls], amp: cls.tr.amp, digits: cls.tr.digits };
      return out;
    }
    if (!cls || !onReturn(page, n)) return cls;
    out = {};
    for (k in cls) if (Object.prototype.hasOwnProperty.call(cls, k)) out[k] = cls[k];
    out.live = cls.live.map(swapAnchor); out.tr = swapAnchor(cls.tr);
    return out;
  }

  /* P2: a simulated reading is a trend point (js/rz-trend.js draws its history from js/conv/history.js) */
  function trendDef(ctx, spec, base, unit, cls) {
    var d = { id: ctx.id + ':' + spec.label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label: (ctx.tag || ctx.id) + ' · ' + spec.label, unit: unit,
      base: base, amp: spec.amp, digits: isNum(spec.digits) ? spec.digits : 1, shape: 'load', cls: cls, group: ctx.tag || ctx.id };
    if (cls === 'ENGINE') d.ref = base;
    return d;
  }
  /* a class reading that the page's tooltip rows also print, under the page's own label (factor = unit conversion:
     a pump head printed in m of water is the same reading as a differential head in kPa) */
  var PAGE_ROW = { 'Speed': ['Speed', 1], 'Motor current': ['Current', 1], 'Differential head': ['Head', 9.80665], 'Vibration (ISO 10816)': ['Vibration', 1], 'Basin level': ['Basin level', 1], 'Fan vibration': ['Fan vibration', 1] };
  function pageRow(ctx, label) {
    var a = PAGE_ROW[label], rows = ctx.rows; if (!a || !rows) return null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i][0] === a[0]) {
        /* the page says it does not model this reading: the payload says so too, never a seeded wave (P3) */
        if (/not modelled/i.test(String(rows[i][1]))) return 'NM';
        var x = parseFloat(String(rows[i][1]).replace(/,/g, ''));
        /* a row the page marks 'engine' prints an engine value (2.7.0 pump speed): the payload says so, not SIM */
        if (isNum(x) && rows[i][2] === 'engine') return { eng: x * a[1] };
        return isNum(x) ? x * a[1] : null;
      }
    }
    return null;
  }
  function rowOf(spec, ctx) {
    var p, v;
    switch (spec.k) {
      case 'B':
        p = param(spec.id);
        if (!p) return { label: spec.label, text: 'UNAVAILABLE', unit: '', quality: 'state', declared: 'registry id ' + spec.id + ' did not resolve — reported, never filled in' };
        return { label: spec.label, text: fmt(p.value, spec.digits), unit: isNum(p.value) ? unitOf(p) : '', quality: 'derived', basis: spec.id };
      case 'SB':
        p = param(spec.id);
        v = p && isNum(p.value) ? wave(ctx.id + ':' + spec.label, ctx.tick, p.value, spec.amp, spec.period) : null;
        return { label: spec.label, text: fmt(v, spec.digits), unit: unitOf(p), quality: 'simulated', sim: true,
          declared: SIMD + '; anchored on the engine value ' + spec.id,
          trend: p && isNum(p.value) ? trendDef(ctx, spec, p.value, unitOf(p), 'ENGINE') : null };
      case 'S':
        /* TR1 (PRD-CONV-EQUIPMENT-INSIDE §4): when the page's own plant simulation prints this reading (read().rows,
           the hover tooltip), the payload shows THAT value, so tooltip, inspector and modal agree at the same tick;
           the seeded wave is only for a reading the page does not simulate */
        var pv = pageRow(ctx, spec.label);
        if (pv && isNum(pv.eng)) return { label: spec.label, text: fmt(pv.eng, 1), unit: spec.unit || '', quality: 'derived',
          declared: 'engine operating value (CONV_CALC fleet unit): pump curve x system curve, the same number as the symbol tooltip' };
        if (pv === 'NM') return { label: spec.label, text: 'not modelled', unit: '', quality: 'state', declared: 'the page plant simulation does not model this reading and the engine does not publish it' };
        if (isNum(pv)) return { label: spec.label, text: fmt(pv, spec.digits), unit: spec.unit || '', quality: 'simulated', sim: true,
          declared: SIMD.replace('seeded deterministic training signal (period and phase from the point id)', 'the page plant simulation (same value as the symbol tooltip)'),
          trend: spec.amp ? trendDef(ctx, spec, pv, spec.unit || '', 'SIM') : null };
        v = spec.amp ? wave(ctx.id + ':' + spec.label, ctx.tick, spec.base, spec.amp, spec.period) : spec.base;
        return { label: spec.label, text: fmt(v, spec.digits), unit: spec.unit || '', quality: 'simulated', sim: true, declared: SIMD,
          trend: spec.amp ? trendDef(ctx, spec, spec.base, spec.unit || '', 'SIM') : null };
      default:
        return { label: spec.label, text: spec.text, unit: '', quality: 'declared', declared: DECL };
    }
  }

  function trendOf(cls, ctx) {
    var t = cls.tr; if (!t) return null;
    var p = t.id ? param(t.id) : null, base = p && isNum(p.value) ? p.value : t.base, amp = t.amp;
    /* a pump the page shows standing by prints Head 0 m from the engine: its differential head trends a flat 0 (E2) */
    var pv = t.label === 'Differential head' ? pageRow(ctx, 'Differential head') : null, sb = pv === 0 || !!(pv && pv.eng === 0);
    if (sb) { base = 0; amp = 0; }
    if (!isNum(base)) return null;
    var series = [], d = isNum(t.digits) ? t.digits : 1, f = Math.pow(10, d + 2);   /* stored finer than printed: the line stays smooth */
    for (var i = 0; i < 60; i++) series.push(Math.round(wave(ctx.id + ':trend', ctx.tick - 59 + i, base, amp, 23) * f) / f);
    var mn = Math.min.apply(null, series), mx = Math.max.apply(null, series), unit = p ? unitOf(p) : (t.unit || '');
    var rows = [
      { label: 'Minimum (60 ticks)', text: fmt(mn, d), unit: unit, quality: 'simulated', sim: true, declared: SIMD },
      { label: 'Maximum (60 ticks)', text: fmt(mx, d), unit: unit, quality: 'simulated', sim: true, declared: SIMD }
    ];
    if (sb) rows.unshift({ label: 'Standing by (reference line)', text: fmt(0, d), unit: unit, quality: 'derived',
      declared: 'the page shows this pump standing by (Head 0 m): no differential head; the duty pumps run at ' + fmt(p ? p.value : t.base, d) + ' ' + unit });
    else if (p) rows.unshift({ label: 'Engine plane (reference line)', text: fmt(p.value, d), unit: unit, quality: 'derived', basis: t.id });
    else rows.unshift({ label: 'Declared normal (reference line)', text: fmt(base, d), unit: unit, quality: 'declared', declared: DECL });
    return { label: t.label + ' (simulated)', unit: unit, series: series, ref: base, rows: rows,
      declared: 'SIMULATED 60-tick series, seeded from the point id; the dashed line is ' + (sb ? 'zero: the pump stands by' : p ? 'the engine value ' + t.id : 'the declared normal value') };
  }

  var DAY = 86400000, FIXTURE_EPOCH = Date.UTC(2026, 9, 1);
  function maintOf(cls, id) {
    var m = STD[cls.m] || STD.none;
    var rows = [
      { label: 'Task', text: m[0], unit: '', quality: 'declared', declared: DECL },
      { label: 'Interval', text: m[1], unit: '', quality: 'declared', declared: DECL },
      { label: 'Standard', text: m[2], unit: '', quality: 'declared', declared: DECL }
    ];
    if (cls.m !== 'none') {
      var last = new Date(FIXTURE_EPOCH + (hash(id) % 28) * DAY).toISOString().slice(0, 10);
      rows.push({ label: 'Last test (TRAINING RECORD)', text: last + ' · passed', unit: '', quality: 'declared', declared: TRAINING });
    }
    return rows;
  }

  var VALUE_LABEL = { st: 'State', kw: 'Electrical input', t: 'Temperature', fb: 'Feedback', spd: 'Speed', cmd: 'Command', q: 'Flow', p: 'Pressure', lvl: 'Level', vol: 'Volume', dur: 'Autonomy', pct: 'Level', use: 'Usable', mw: 'Load',
    pw: 'Power flow', amp: 'Current', ld: 'Load', r: 'Rating', u: 'Unit rating', bus: 'Bus', bb1: 'Busbar 1', bb2: 'Busbar 2', set: 'Setting' };
  function endNode(end) { return typeof end === 'string' ? end.split('.')[0] : null; }
  function byId(nodes, id) { for (var i = 0; i < nodes.length; i++) if (nodes[i].id === id) return nodes[i]; return null; }
  function tagOf(nodes, id) { var n = byId(nodes, id); return n && n.tag ? n.tag : String(id).toUpperCase(); }
  function endPt(nodes, end) {
    if (Array.isArray(end)) return end;
    var n = byId(nodes, endNode(end));
    return n ? [n.x, n.y] : null;
  }
  /* true when point pt lies within 4 units of edge e's polyline (endpoints at node centres, then the via points) */
  function onLine(edges, nodes, e, pt) {
    var p0 = endPt(nodes, e.from), p1 = endPt(nodes, e.to);
    if (!p0 || !p1) return false;
    var pts = [p0].concat(e.via || [], [p1]);
    for (var i = 1; i < pts.length; i++) {
      var p = pts[i - 1], q = pts[i];
      if (pt[0] >= Math.min(p[0], q[0]) - 4 && pt[0] <= Math.max(p[0], q[0]) + 4 && pt[1] >= Math.min(p[1], q[1]) - 4 && pt[1] <= Math.max(p[1], q[1]) + 4) return true;
    }
    return false;
  }

  function build(o) {
    var n = o.node || {}, page = o.page || o.classId || 'conv', cls = classOf(page, n.sym, n);
    var reg = registry(), tick = isNum(o.tick) ? o.tick : 0, id = n.id || 'x', tag = n.tag || id;
    var r = o.read || {}, values = r.values || {}, live = [], alarms = [];
    var ctx = { id: page + ':' + id, tick: tick, tag: tag, rows: Array.isArray(r.rows) ? r.rows : null };
    var qualityWord = { good: 'measured', stale: 'stale', bad: 'bad', nodata: 'no data' };
    /* 1. the sheet's own state rows (what the drawing prints), each with its point quality */
    Object.keys(values).forEach(function (k) {
      var v = values[k] || {}, pid = id + ':' + k;
      var rec = o.store && o.store.ids && o.store.ids().indexOf(pid) >= 0 ? o.store.get(pid) : null;
      live.push({ label: VALUE_LABEL[k] || k.toUpperCase(), text: v.text == null ? '—' : String(v.text), unit: '',
        quality: rec && rec.quality !== 'good' ? 'state' : 'simulated', sim: !rec || rec.quality === 'good',
        declared: (rec ? 'point ' + pid + ' · quality ' + (qualityWord[rec.quality] || rec.quality) + ' · ' : '') + (o.declared || SIMD) });
      if (v.alarm) alarms.push({ severity: v.alarm === '1' ? 'CRITICAL' : 'WARNING', lifecycle: o.acked ? 'acknowledged' : 'active',
        tag: tag, point: pid, message: (VALUE_LABEL[k] || k) + ' ' + (v.text == null ? '' : v.text) });
    });
    if (r.mismatch || (o.mismatch && o.mismatch(id))) {
      alarms.push({ severity: 'WARNING', lifecycle: o.acked ? 'acknowledged' : 'active', tag: tag, point: id + ':cmd', message: 'command and feedback disagree' });
    }
    /* 2. the class rows */
    var none = 'no class recipe for symbol "' + (n.sym || '?') + '" — reported, never filled in';
    (cls ? cls.live : []).forEach(function (s) { live.push(rowOf(s, ctx)); });
    live.push({ label: 'Role', text: cls ? cls.role : none, unit: '', quality: 'declared', declared: DECL });
    var capacity = cls ? cls.cap.map(function (s) { return rowOf(s, ctx); }) : [{ label: 'Capacity', text: 'UNAVAILABLE', unit: '', quality: 'state', declared: none }];
    var alarmPoints = cls ? cls.al.map(function (s) { return rowOf(s, ctx); }) : [];
    var trend = cls ? trendOf(cls, ctx) : null;
    var maint = cls ? maintOf(cls, page + ':' + id) : [{ label: 'Maintenance', text: 'UNAVAILABLE', unit: '', quality: 'state', declared: none }];
    /* 3. dependencies from the drawing's own edges */
    var up = [], down = [], seen = {}, nodes = o.nodes || [];
    function addDep(list, key, x) {
      resolve(x, 0, {}).forEach(function (t) { if (t !== id && !seen[key + t]) { seen[key + t] = 1; list.push({ id: t, label: tagOf(nodes, t) }); } });
    }
    (o.edges || []).forEach(function (e) {
      var a = endNode(e.from), b = endNode(e.to);
      if (b === id && a && a !== id) addDep(up, 'u', a);
      if (a === id && b && b !== id) addDep(down, 'd', b);
    });
    /* a signal bus or an instrument tap ends at a point on another line: the equipment on that line is a dependency */
    (o.edges || []).forEach(function (e) {
      var a = endNode(e.from), b = endNode(e.to), mine = a === id || b === id;
      [[e.from, a], [e.to, b]].forEach(function (end) {
        if (!Array.isArray(end[0])) return;
        (o.edges || []).forEach(function (f) {
          if (f === e || !onLine(o.edges, nodes, f, end[0])) return;
          var fa = endNode(f.from), fb = endNode(f.to);
          if (mine) { if (fa && fa !== id) addDep(up, 'u', fa); if (fb && fb !== id) addDep(down, 'd', fb); }
          else if (fa === id || fb === id) { if (a) addDep(down, 'd', a); if (b) addDep(down, 'd', b); }
        });
      });
    });
    /* an instrument tap that lands on a vessel body: the vessel is the dependency */
    (o.edges || []).forEach(function (e) {
      [[e.from, e.to], [e.to, e.from]].forEach(function (pair) {
        if (!Array.isArray(pair[0]) || endNode(pair[1]) !== id) return;
        nodes.forEach(function (m) {
          var h = (m.size || 20) / 2 + 6;
          if (m.id !== id && m.sym !== 'junction' && Math.abs(m.x - pair[0][0]) <= h + 30 && Math.abs(m.y - pair[0][1]) <= h + 30) addDep(up, 'u', m.id);
        });
      });
    });
    /* a field device with no drawn edge sits on a signal bus (SLC loop): the bus owner is its upstream */
    if (!up.length && !down.length && byId(nodes, id)) {
      var me = byId(nodes, id);
      (o.edges || []).forEach(function (e) {
        if (e.w !== 'signal') return;
        var p0 = endPt(nodes, e.from), p1 = endPt(nodes, e.to);
        if (!p0 || !p1) return;
        var xs = [p0[0], p1[0]].concat((e.via || []).map(function (v) { return v[0]; })), ys = [p0[1], p1[1]].concat((e.via || []).map(function (v) { return v[1]; }));
        if (me.x >= Math.min.apply(null, xs) && me.x <= Math.max.apply(null, xs) && Math.abs(me.y - Math.max.apply(null, ys)) <= 90) {
          [endNode(e.from), endNode(e.to)].forEach(function (t) { if (t && t !== id) addDep(up, 'u', t); });
        }
      });
    }
    /* a sensor drawn without a line (leak sensor in a sump) monitors the nearest vessel */
    if (!up.length && !down.length && byId(nodes, id)) {
      var me2 = byId(nodes, id), best = null, bd = 260;
      nodes.forEach(function (m) {
        if (!/^(tankStorage|tankExpansion|gensetDiesel)$/.test(m.sym)) return;
        var d = Math.sqrt(Math.pow(m.x - me2.x, 2) + Math.pow(m.y - me2.y, 2));
        if (d < bd) { bd = d; best = m.id; }
      });
      if (best) addDep(up, 'u', best);
    }
    function resolve(x, depth, vis) {
      var nd = byId(nodes, x);
      if (!nd || nd.sym !== 'junction') return [x];
      if (depth > 6 || vis[x]) return [];
      vis[x] = 1;
      var out = [];
      (o.edges || []).forEach(function (e) {
        var a = endNode(e.from), b = endNode(e.to);
        if (a === x && b) out = out.concat(resolve(b, depth + 1, vis));
        if (b === x && a) out = out.concat(resolve(a, depth + 1, vis));
        /* a header drawn from a junction to a point: junctions sitting on that header join it */
        if ((a === x && Array.isArray(e.to)) || (b === x && Array.isArray(e.from))) {
          nodes.forEach(function (m) { if (m.sym === 'junction' && m.id !== x && !vis[m.id] && onLine(o.edges, nodes, e, [m.x, m.y])) out = out.concat(resolve(m.id, depth + 1, vis)); });
        }
      });
      return out;
    }
    var al = r.alarm || (alarms.length ? '2' : null);
    var chip = al === '1' ? { label: 'ALARM', state: 'alarm' } : (al ? { label: 'WARNING', state: 'warning' }
      : { label: String(r.state || 'normal').toUpperCase(), state: 'normal' });
    var all = live.concat(capacity, alarmPoints, maint, trend ? trend.rows : []);
    var counts = { derived: 0, published: 0, simulated: 0, state: 0 };
    all.forEach(function (x) { if (x.basis) counts.derived++; else if (x.sim) counts.simulated++; else counts.state++; });
    return freeze({
      classId: page, id: id, hall: null, title: tag + (n.label ? ' — ' + n.label : ''), kind: cls ? cls.name : (n.sym || 'equipment'),
      label: o.scope || 'site-wide plant', statusChip: chip, guidance: cls ? cls.g : none, sym: n.sym || null,
      tabs: { live: live, capacity: capacity, deps: { upstream: up.slice(0, 8), downstream: down.slice(0, 8), edges: [] }, alarms: alarms, alarmPoints: alarmPoints, trend: trend, maint: maint },
      actions: { openHmi: !!cls, related: [] },
      provenance: { engineVersion: o.engineVersion || (reg && reg.engineVersion) || '—', registryVersion: reg ? reg.engineVersion : '—',
        scenarioId: o.scenario || 'simulated', coolingScenarioId: 'site', tick: tick, counts: counts }
    });
  }

  /* merge(page, cls): a page that already builds a richer payload from its own engine reads (water-system.html)
     keeps every non-empty tab; the class recipe fills the empty ones and adds the configured alarm points, the
     trend, the maintenance record, the guidance and the "Open equipment HMI" action. */
  function merge(pageP, clsP) {
    if (!pageP) return clsP;
    if (!clsP) return pageP;
    var a = pageP.tabs, b = clsP.tabs, has = function (x) { return x && x.length; };
    var out = {};
    Object.keys(pageP).forEach(function (k) { out[k] = pageP[k]; });
    out.tabs = { live: has(a.live) && a.live.length >= 4 ? a.live : (a.live || []).concat(b.live.slice(0, Math.max(0, 4 - (a.live || []).length))),
      capacity: has(a.capacity) ? a.capacity : b.capacity,
      deps: (a.deps && (has(a.deps.upstream) || has(a.deps.downstream))) ? a.deps : b.deps,
      alarms: a.alarms || [], alarmPoints: b.alarmPoints, trend: a.trend || b.trend,
      maint: (a.maint || []).concat(b.maint) };
    out.kind = clsP.kind; out.guidance = clsP.guidance; out.sym = clsP.sym;
    out.actions = { openHmi: true, related: (pageP.actions && pageP.actions.related) || [] };
    return freeze(out);
  }

  var API = { build: build, merge: merge, classOf: classOf, classes: function () { return Object.keys(CLASSES); }, fmt: fmt, version: '1.0.0', _wave: wave };
  if (root) root.RZConvPayloads = Object.freeze(API);
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : null);
