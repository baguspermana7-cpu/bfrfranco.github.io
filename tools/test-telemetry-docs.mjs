#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const REQUIRED_SCRIPTS = [
  '../js/rz-version.js',
  '../js/rz-mobile-nav.js',
  '../js/rz-cookie-consent.js',
  '../js/rz-explain.js',
  '../js/rz-documentation-ui.js',
];
const REQUIRED_STYLES = ['../css/rz-documentation-ui.css'];
const BASELINE_REV = '2348d9ab6ebf121332c48d7b02f1c6398c232039';
const INTENTIONAL_MANUAL_REPLACEMENTS = Object.freeze({
  datahallai: Object.freeze({
    /* v2.0.0 — the AI manual was rewritten against the GB300 engine snapshot. Every retired
       GB200 formula, result and source fragment maps to the fragment that replaced it; the
       map was generated from the two files and reviewed, not typed. */
    '<li><b>NVIDIA GB200 NVL72</b> — Blackwell GPU rack-scale specification: 72 GPU + 36 Grace CPU per NVL72, direct liquid cooling, ~120–140 kW per NVL72 domain (adopted design value 132 kW).</li>':
      '<span class="mn-src">NVIDIA GB300 NVL72 spec</span>',
    '<span class="mn-eq">IT_kW = Σ rack_kW + network_kW + storage_kW</span>':
      '<span class="mn-eq">Total_IT_kWe = Rack_IT_kWe + fabric_kWe + OOB_kWe + storage/mgmt_kWe</span>',
    '<span class="mn-src">doc-00 line 107 · doc-21 Ex1</span>':
      '<span class="mn-src">NVIDIA GB300 NVL72 spec</span>',
    '<span class="mn-eq">NVL72_kW = racksPerNVL72 × rack_kW</span>':
      '<span class="mn-eq">1 NVL72 rack = 1 NVLink domain = 72 GPU + 36 Grace CPU + 18 NVSwitch</span>',
    '<span class="mn-src">doc-00 line 108 · doc-21 Ex1</span>':
      '<span class="mn-src">NVIDIA GB300 NVL72 spec</span>',
    '<span class="mn-eq">Facility_kW = IT_kW + coolingElec_kW + upsLoss_kW + distLoss_kW + aux_kW</span>':
      '<span class="mn-eq">Facility_kWe = Total_IT_kWe + cooling_kWe + upsLoss_kWe + distLoss_kWe + aux_kWe</span>',
    '<span class="mn-src">doc-00 line 109</span>':
      '<span class="mn-src">js/dcai-engine.js compute() · tools/test-dcai-engine.mjs</span>',
    '<span class="mn-eq">PUE = Facility_kW / IT_kW</span>':
      '<span class="mn-eq">Facility_kWe = Total_IT_kWe + cooling_kWe + upsLoss_kWe + distLoss_kWe + aux_kWe</span>',
    '<span class="mn-src">doc-00 line 110 · doc-21 Ex9 · ISO/IEC 30134-2</span>':
      '<span class="mn-src">js/dcai-engine.js operatingPoint() · ISO/IEC 30134-2</span>',
    '<span class="mn-eq">Liquid_heat_kW = IT_kW × liquid_capture_ratio (0.85 for NVL72 direct liquid)</span>':
      '<span class="mn-eq">Liquid_heat_kWth = Rack_IT_kWe × liquid_capture_ratio (0.85 direct liquid)</span>',
    '<span class="mn-eq">Air_heat_kW = IT_kW × (1 − liquid_capture_ratio)</span>':
      '<span class="mn-eq">Air_heat_kWth = Rack_IT_kWe × (1 − liquid_capture_ratio) + fabric + OOB + storage/mgmt + UPS-loss + dist-loss + aux</span>',
    '<span class="mn-src">doc-00 lines 114-115 · doc-21 Ex5</span>':
      '<span class="mn-src">js/dcai-engine.js compute() · tools/test-dcai-engine.mjs</span>',
    '<span class="mn-eq">Flow_LPM = Q_kW × 60 / (ρ_kg/L × Cp_kJ/kg·K × ΔT_K)</span>':
      '<span class="mn-eq">Flow_m³/h = Q_kWth × 3600 / (ρ_kg/m³ × Cp_kJ/kg·K × ΔT_K)</span>',
    '<span class="mn-src">doc-00 line 117 · doc-21 Ex6 · BASELINE-DECISION.md</span>':
      '<span class="mn-src">js/dcai-engine.js flowM3h() · design.flows.tcs_m3h</span>',
    '<span class="mn-eq">CDU_running = ceil( Liquid_heat_kW / CDU_rating_kW )</span>':
      '<span class="mn-eq">CDU_duty = ceil( Liquid_heat_kWth_per_hall / CDU_unit_kWth )</span>',
    '<span class="mn-src">doc-21 Ex7</span>':
      '<span class="mn-src">js/dcai-engine.js ceilCount() · equipment.cdu_installed_facility</span>',
    '<span class="mn-eq">perCRAH_kW = Air_heat_kW / activeUnits</span>':
      '<span class="mn-eq">perCRAH_kWth = Air_heat_kWth / CRAH_duty_units</span>',
    '<span class="mn-eq">Flow_m3/h = Q_kW × 3600 / (ρ_kg/m³ × Cp_kJ/kg·K × ΔT_K)</span>':
      '<span class="mn-eq">Flow_m³/h = Q_kWth × 3600 / (ρ_kg/m³ × Cp_kJ/kg·K × ΔT_K)</span>',
    '<span class="mn-src">doc-00 line 118 · doc-21 Ex8</span>':
      '<span class="mn-src">js/dcai-engine.js airM3s() · equipment.crah_installed_facility</span>',
    '<span class="mn-eq">Chiller_input_kW = cooling_heat_kW / COP_nameplate</span>':
      '<span class="mn-eq">COP = min(copMax, carnotFraction × Carnot)</span>',
    '<span class="mn-src">doc-00 line 119 · doc-21 Ex9</span>':
      '<span class="mn-src">js/dcai-engine.js copFromLift() · design.planes.p18_cop_air_path</span>',
    '<span class="mn-eq">chillerInput_kW = IT_kW / COP (COP = 6.8 nameplate)</span>':
      '<span class="mn-eq">COP = min(copMax, carnotFraction × Carnot)</span>',
    '<span class="mn-eq">pumps_kW = 200 × (IT / 7128) (scale from Ex9 ref)</span>':
      '<span class="mn-eq">for each weather bin: op = operatingPoint(model, bin.ambientDbC, fixed)</span>',
    '<span class="mn-eq">fans_kW = 250 × (IT / 7128)</span>':
      '<span class="mn-eq">for each weather bin: op = operatingPoint(model, bin.ambientDbC, fixed)</span>',
    '<span class="mn-eq">cduPumps_kW = 120 × (IT / 7128)</span>':
      '<span class="mn-eq">for each weather bin: op = operatingPoint(model, bin.ambientDbC, fixed)</span>',
    '<span class="mn-eq">crahFans_kW = 80 × (IT / 7128)</span>':
      '<span class="mn-eq">for each weather bin: op = operatingPoint(model, bin.ambientDbC, fixed)</span>',
    '<span class="mn-eq">upsDistLoss_kW = 300 × (IT / 7128)</span>':
      '<span class="mn-eq">for each weather bin: op = operatingPoint(model, bin.ambientDbC, fixed)</span>',
    '<span class="mn-eq">aux_kW = 150 × (IT / 7128)</span>':
      '<span class="mn-eq">for each weather bin: op = operatingPoint(model, bin.ambientDbC, fixed)</span>',
    '<span class="mn-eq">nonIT_kW = chillerInput + pumps + fans + cduPumps + crahFans + upsDistLoss + aux</span>':
      '<span class="mn-eq">Facility_kWe = Total_IT_kWe + cooling_kWe + upsLoss_kWe + distLoss_kWe + aux_kWe</span>',
    '<span class="mn-eq">Facility_kW = IT_kW + nonIT_kW</span>':
      '<span class="mn-eq">Facility_kWe = Total_IT_kWe + cooling_kWe + upsLoss_kWe + distLoss_kWe + aux_kWe</span>',
    '<span class="mn-src">doc-21 Ex9 · doc-00 lines 301-308 · BASELINE-DECISION.md</span>':
      '<span class="mn-src">js/dcai-engine.js operatingPoint() · ISO/IEC 30134-2</span>',
    '<span class="mn-src">doc-00 lines 122-123 · doc-21 Ex3 · doc-21 Ex4</span>':
      '<span class="mn-src">js/dcai-engine.js compute() · distribution.group_kw · distribution.busway_trunk_a</span>',
    '<span class="mn-src">doc-21 Ex10</span>':
      '<span class="mn-src">data/dcai-parameters.json geometry.*</span>',
    '<span class="mn-result">54 rack positions/hall</span>':
      '<span class="mn-result">Rack IT = 124,960 kW/hall</span>',
    '<span class="mn-result">IT = 3,564 kW/hall</span>':
      '<span class="mn-result">Rack IT = 124,960 kW/hall</span>',
    '<span class="mn-result">79.2% load</span>':
      '<span class="mn-result">79.9% UPS loading</span>',
    '<span class="mn-result">5,357 A</span>':
      '<span class="mn-result">4,697 A</span>',
    '<span class="mn-result">6,300 A selected</span>':
      '<span class="mn-result">5,000 A busway trunk</span>',
    '<span class="mn-result">3,713 kVA</span>':
      '<span class="mn-result">4,697 A</span>',
    '<span class="mn-result">74.3%</span>':
      '<span class="mn-result">5,000 A busway trunk</span>',
    '<span class="mn-result">3,029 kW</span>':
      '<span class="mn-result">106,216 kW/hall</span>',
    '<span class="mn-result">535 kW</span>':
      '<span class="mn-result">35,509 kW/hall</span>',
    '<span class="mn-result">4,342 LPM total</span>':
      '<span class="mn-result">9,612.3 m³/h/hall</span>',
    '<span class="mn-result">80.4 LPM/rack</span>':
      '<span class="mn-result">9,612.3 m³/h/hall</span>',
    '<span class="mn-result">9 CDUs running</span>':
      '<span class="mn-result">107 CDUs running</span>',
    '<span class="mn-result">18.4 m³/h/CRAH</span>':
      '<span class="mn-result">178 CRAH running/hall</span>',
    '<span class="mn-result">1,048 kW</span>':
      '<span class="mn-result">35,509 kW/hall</span>',
    '<span class="mn-result">2,148 kW</span>':
      '<span class="mn-result">1.165</span>',
    '<span class="mn-result">1.30</span>':
      '<span class="mn-result">1.165</span>',
    '<span class="mn-result">2,688 m³/hall</span>':
      '<span class="mn-result">10,571 m³/hall</span>',
    '<li><b>BASELINE-DECISION.md (locked 2026-05-17)</b> — Single immutable source of truth for the whole cockpit: 4 halls, 27 NVL72/hall, 132 kW/NVL72 (Scenario A), 85% liquid capture, TCS 35/45 °C, PUE design band 1.12–1.25.</li>':
      '<li><b>js/datahall-model.js + js/datahall-calculations.js (RETIRED 2026-09-06)</b> — the byte-frozen retired-era pair, kept only as the retirement record; see §02 "Retired basis" note.</li>',
    '<li><b>21-calculation-worked-examples.md (doc-21)</b> — 10 fully-traced examples (Ex1–Ex10) that are the acceptance test cases for <code class="mn-mono">tools/test-datahall-calc.mjs</code> (57/57 assertions).</li>':
      '<li><b>tools/test-dcai-engine.mjs</b> — balance-identity acceptance tests (IT = rack + fabric + OOB + storage/mgmt, facility = IT + non-IT, PUE = facility / IT, weather bins sum to 8,760 h, and more) run on every change to the engine.</li>',
    '<li><b>Carrier 19DV centrifugal chiller</b> — Nameplate COP 6.8 used in doc-21 Ex9 (not calibrated to hit a target PUE).</li>':
      '<li><b>Chiller COP methodology</b> — derived from a Carnot-fraction over the actual evaporator/condenser lift (<code class="mn-mono">copFromLift()</code>), never a vendor nameplate figure, and never calibrated to hit a target PUE.</li>',
    '<li><b>Engine sources</b> — <code class="mn-mono">js/datahall-calculations.js</code> (DATAHALL_CALC, pure derivation engine) + <code class="mn-mono">js/datahall-model.js</code> (DATAHALL_MODEL, deep-frozen basis).</li>':
      '<li><b>Engine sources</b> — <code class="mn-mono">js/dcai-engine.js</code> (DCAI_CALC, pure derivation engine) + <code class="mn-mono">js/dcai-model.js</code> (DCAI_MODEL, deep-frozen authored basis) + <code class="mn-mono">js/dcai-parameters.js</code> (shared registry for the basis drawer).</li>',
    '<li><b>standarization/ACCURACY_VALIDATION.md</b> — 6 accuracy rules + 40 acceptance tests enforced by <code class="mn-mono">tools/probe-accuracy-validation.mjs</code>.</li>':
      '<li><b>standarization/ACCURACY_VALIDATION.md</b> — 6 accuracy rules enforced by <code class="mn-mono">tools/probe-accuracy-validation.mjs</code>.</li>',
    '<span class="mn-eq">kW = √3 × V_LL × I × PF / 1000 [3-phase real power check]</span>':
      '<span class="mn-eq">I_A = kW × 1000 / (√3 × V_LL × PF) [required current]</span>',
    '<li><b>00-overview-audit.md (doc-00)</b> — Core Calculation Engine definition (lines 104-125), Source Sanity References, equipment corrections (Cat 3516E ≈ 2.5–2.75 MW).</li>':
      '<li><b>Engine sources</b> — <code class="mn-mono">js/dcai-engine.js</code> (DCAI_CALC, pure derivation engine) + <code class="mn-mono">js/dcai-model.js</code> (DCAI_MODEL, deep-frozen authored basis) + <code class="mn-mono">js/dcai-parameters.js</code> (shared registry for the basis drawer).</li>',
  }),
  'dc-conventional': Object.freeze({
    '<span class="mn-eq">Facility = IT × PUE → 1 850 × 1.45 = 2 682.5 kW</span>':
      '<span class="mn-eq">Facility = IT × PUE → 30 000 × 1.45 = 43 500 kW</span>',
    '<span class="mn-eq">Non-IT = Facility − IT → 2 682.5 − 1 850 = 832.5 kW</span>':
      '<span class="mn-eq">Non-IT = Facility − IT → 43 500 − 30 000 = 13 500 kW</span>',
    '<span class="mn-eq">PUE = Facility / IT = 2 682.5 / 1 850 = 1.45 (identity check)</span>':
      '<span class="mn-eq">PUE = Facility / IT = 43 500 / 30 000 = 1.45 (identity check)</span>',
    '<span class="mn-eq">UPS loss = IT × (1/η − 1) → 1 850 × (1/0.96 − 1) = 77.1 kW</span>':
      '<span class="mn-eq">UPS loss = IT × (1/η − 1) → 30 000 × (1/0.96 − 1) = 1 250 kW</span>',
    '<span class="mn-eq">Per module (2N) = UPS output / count → 1 850 / 2 = 925 kW per module</span>':
      '<span class="mn-eq">Normal module load = IT / 64 → 30 000 / 64 = 468.75 kW/module</span>',
    '<span class="mn-src">doc-09 line 39; doc-01 §UPS A / UPS B</span>':
      '<span class="mn-src">governed 2N resilience contract; engine v2.0.0</span>',
    '<span class="mn-eq">ΔT = CHWR − CHWS = 14.8 − 7.2 = 7.6 K</span>':
      '<span class="mn-eq">ΔT = CHWR − CHWS → 27.0 − 19.4 = 7.6 K</span>',
    '<span class="mn-eq">CHW flow = IT load / (Cp × ΔT) → 1 850 / (4.186 × 7.6) = 58.1 L/s</span>':
      '<span class="mn-eq">IT sensible-load CHW reference = IT / (Cp × ΔT) → 30 000 / (4.186 × 7.6) = 943.0 L/s</span>',
    '<span class="mn-eq">Heat rejection = IT + UPS loss → 1 850 + 77.1 = 1 927.1 kW (sanity band 1 850–1 950)</span>':
      '<span class="mn-eq">Evaporator duty = IT + UPS loss → 30 000 + 1 250 = 31 250 kW</span>',
    '<span class="mn-src">doc-09 lines 81–85; doc-00 line 83</span>':
      '<span class="mn-src">governed rack-inlet target; engine v2 thermal chain</span>',
    '<span class="mn-eq">Instant equivalent flow = (WUE × IT) / 60 → (1.20 × 1 850) / 60 = 37.0 L/min</span>':
      '<span class="mn-eq">Equivalent cooling makeup = (WUE × IT) / 60 → (1.20 × 30 000) / 60 = 600.0 L/min</span>',
    '<span class="mn-src">doc-09 lines 99–104; ISO/IEC 30134-2</span>':
      '<span class="mn-src">CONV_CALC.snapshot.water.flow_lpm_for_wue; engine v2.0.0; ISO/IEC 30134-9:2022</span>',
    '<span class="mn-eq">Carbon rate = Facility × grid factor → 2 682.5 × 0.42 = 1 126.7 kgCO₂/hr</span>':
      '<span class="mn-eq">Carbon rate = Facility × grid factor → 43 500 × 0.42 = 18 270 kgCO₂/hr</span>',
    '<span class="mn-eq"> = 60 000 × 0.90 × 0.85 = 45 900 L</span>':
      '<span class="mn-eq"> = 972 737 × 0.90 × 0.85 = 744 144 L</span>',
    '<span class="mn-eq"> = 45 900 / 956 = 48.0 hr</span>':
      '<span class="mn-eq"> = 744 144 / 15 503 = 48.0 hr</span>',
    '<span class="mn-src">doc-09 lines 132–147; Uptime Institute Tier Standard</span>':
      '<span class="mn-src">sourced specific-consumption rate; adopted campus basis</span>',
    '<span class="mn-eq">Active racks = IT load / rack density (illustrative cross-sections)</span>':
      '<span class="mn-eq">Campus rack inventory = 4 halls × 500 racks/hall = 2 000 racks</span>',
    '<span class="mn-eq"> At 6 kW/rack: 1 850 / 6 = 308 racks</span>':
      '<span class="mn-eq">Current average density = 30 000 kW / 2 000 racks = 15 kW/rack</span>',
    '<span class="mn-eq"> At 8 kW/rack: 1 850 / 8 = 231 racks</span>':
      '<span class="mn-eq">Design average density = 40 000 kW / 2 000 racks = 20 kW/rack</span>',
    '<span class="mn-eq"> At 10 kW/rack: 1 850 / 10 = 185 racks</span>':
      '<span class="mn-eq">Current average density = 30 000 kW / 2 000 racks = 15 kW/rack</span>',
    '<span class="mn-src">doc-09 lines 51–63</span>':
      '<span class="mn-src">governed four-hall rack basis; engine v2.0.0</span>',
    '<span class="mn-eq">EPMS total = Facility load = 2 682.5 kW (nominal; tolerance band ±2%)</span>':
      '<span class="mn-eq">EPMS total = Facility load = 43 500 kW (nominal; tolerance band ±2%)</span>',
    '<span class="mn-eq">EPMS UPS output = IT load = 1 850 kW (mechanical on gen-backed board)</span>':
      '<span class="mn-eq">EPMS UPS output = IT load = 30 000 kW (mechanical on gen-backed board)</span>',
    '<span class="mn-result">2 682.5 kW</span>':
      '<span class="mn-result">43 500 kW</span>',
    '<span class="mn-result">832.5 kW</span>':
      '<span class="mn-result">13 500 kW</span>',
    '<span class="mn-result">77.1 kW</span>':
      '<span class="mn-result">1 250 kW</span>',
    '<span class="mn-result">925.0 kW</span>':
      '<span class="mn-result">468.75 kW</span>',
    '<span class="mn-result">58.1 L/s</span>':
      '<span class="mn-result">943.0 L/s</span>',
    '<span class="mn-result">1 927.1 kW</span>':
      '<span class="mn-result">31 250 kW</span>',
    '<span class="mn-result">37.0 L/min</span>':
      '<span class="mn-result">600.0 L/min</span>',
    '<span class="mn-result">1 126.7 kgCO₂/hr</span>':
      '<span class="mn-result">18 270 kgCO₂/hr</span>',
    '<span class="mn-result">45 900 L</span>':
      '<span class="mn-result">744 144 L</span>',
    '<span class="mn-result">231 racks</span>':
      '<span class="mn-result">2 000 racks</span>',
    '<li><b>Uptime Institute Tier Standard</b> — Operational Sustainability (2021): 48 hr fuel autonomy requirement for Tier III/IV maintained availability.</li>':
      '<li><b>Uptime Institute Tier Standard</b> — topology and concurrently-maintainable design intent; the cockpit does not claim certification or infer a universal fuel duration.</li>',
    '<li><b>ISO/IEC 30134-2</b> — Key Performance Indicators for Data Centres — Part 2: Power Usage Effectiveness (PUE) and Water Usage Effectiveness (WUE) definitions.</li>':
      '<li><b>ISO/IEC 30134-2:2026</b> — Data-centre Power Usage Effectiveness (PUE) definition and reporting boundary.</li>',
    '<li><b>Engine source</b> — <code class="mn-mono">js/conv-engine.js</code> (CONV_CALC v1.0.0 + CONV_MODEL, deep-frozen). Gate: <code class="mn-mono">tools/test-conv-calc.mjs</code> (22/22 DoD identities).</li>':
      '<li><b>Engine source</b> — <code class="mn-mono">js/conv-engine.js</code> (CONV_CALC v2.0.0 + CONV_MODEL, deep-frozen). Gates: <code class="mn-mono">tools/test-conv-calc.mjs</code> and <code class="mn-mono">tools/test-conv-campus-model.mjs</code>.</li>',
    '<li><b>Accuracy gate</b> — <code class="mn-mono">tools/probe-accuracy-validation.mjs</code> (40/40 acceptance tests, 6 accuracy rules). Must pass before any cockpit change ships.</li>':
      '<li><b>Accuracy gate</b> — <code class="mn-mono">tools/probe-accuracy-validation.mjs</code> plus the strict ship gate. Every required assertion must pass before any cockpit change ships.</li>',
    '<tr><td>Design Studio scopes</td><td><code>tools/test-rz-design-studio.mjs</code> plus browser/PDF journey</td><td>Current renders the adopted 30 MW operating point; current-plus-design adds the 40 MW/58 MW design point without mutating <code>CONV_CALC.snapshot</code>.</td></tr>':
      '<tr><td>Design Studio scopes</td><td><code>tools/test-rz-design-studio.mjs</code> plus browser/PDF journey</td><td>Current renders the adopted 30 MW operating point; current-plus-study adds the governed 40 MW/58 MW design-point study without mutating <code>CONV_CALC.snapshot</code>.</td></tr>',
    '<p class="mn-lead"><strong>Design Studio:</strong> The <em>current</em> scope is generated from the captured 30 MW <code class="mn-mono">CONV_CALC.snapshot</code>. The <em>current-plus-design</em> scope appends the 40 MW/58 MW design point; changing scope does not change cockpit data.</p>':
      '<p class="mn-lead"><strong>Design Studio:</strong> The <em>current</em> scope is generated from the captured 30 MW <code class="mn-mono">CONV_CALC.snapshot</code>. The <em>current-plus-study</em> scope appends the governed 40 MW/58 MW design-point study; changing scope does not change cockpit data.</p>',
    '<tr><td>Generate Design / Design Studio</td><td><code>genDesignTrigConv</code>, <code>RZDesignStudio</code></td><td>Open the shared dialog, show captured snapshot/provenance, and select current or current-plus-design before generating the approved document type.</td><td>The design-point appendix cannot mutate current values; focus is trapped and returned, and generation failure remains visible.</td></tr>':
      '<tr><td>Generate Design / Design Studio</td><td><code>genDesignTrigConv</code>, <code>RZDesignStudio</code></td><td>Open the shared dialog, show captured snapshot/provenance, and select current or current-plus-study before generating the approved document type.</td><td>The design-point study appendix cannot mutate current values; focus is trapped and returned, and generation failure remains visible.</td></tr>',
    '<tr><td>Uptime basis</td><td><code>data-basis="uptime"</code></td><td>Explain 99.98% and Tier intent.</td><td>Explicit design placeholder; no outage ledger is bound.</td></tr>':
      '<tr><td>Uptime basis</td><td><code>data-basis="uptime"</code></td><td>Explain &mdash; / UNAVAILABLE and the required downtime event log.</td><td>No numeric or healthy-state placeholder is allowed until an authenticated outage ledger is bound.</td></tr>',
    '<tr><td>Network / topology / uptime</td><td>Network, UPS Topology, Uptime rows</td><td>Static modeled state / placeholder.</td><td>Online and 2N OK are overview claims; 99.98% is not event-derived.</td></tr>':
      '<tr><td>Network / topology / uptime</td><td>Network, UPS Topology, Uptime rows</td><td>Static modeled state / unavailable evidence.</td><td>Online and 2N OK are overview claims; uptime fails closed as UNAVAILABLE because it is not event-derived.</td></tr>',
    '<tr><td>Four-hall design-point appendix</td><td>Design Studio current-plus-design</td><td>Governed capacity envelope paired with the adopted operating snapshot.</td><td>4 × 10 MW = 40 MW IT and 58 MW facility are the design point; current remains 4 × 7.5 MW = 30 MW IT.</td></tr>':
      '<tr><td>Four-hall design-point appendix</td><td>Design Studio current-plus-study</td><td>Governed planning-study envelope paired with the adopted operating snapshot.</td><td>4 × 10 MW = 40 MW IT and 58 MW facility are the design-point study; current remains 4 × 7.5 MW = 30 MW IT.</td></tr>',
    '<tr><td>Four-hall design-point appendix</td><td>4 × 10 MW IT; 500 racks/hall; 20 kW/rack design average</td><td>MW IT / rack / kW·rack⁻¹</td><td>Current-plus-design scope: 40 MW IT / 58 MW facility design point</td></tr>':
      '<tr><td>Four-hall design-point appendix</td><td>4 × 10 MW IT; 500 racks/hall; 20 kW/rack design average</td><td>MW IT / rack / kW·rack⁻¹</td><td>Current-plus-study scope: governed 40 MW IT / 58 MW facility design-point study</td></tr>',
  }),
  datahall: Object.freeze({
    '<span class="mn-eq">= 1,850 × 1.45 = 2,682.5 kW</span>':
      '<span class="mn-eq">= 30,000 × 1.45 = 43,500 kW</span>',
    '<span class="mn-eq">= 2,682.5 − 1,850 = 832.5 kW</span>':
      '<span class="mn-eq">= 43,500 − 30,000 = 13,500 kW</span>',
    '<span class="mn-eq">= 1,850 × (1/0.96 − 1) = 77.1 kW</span>':
      '<span class="mn-eq">= 30,000 × (1/0.96 − 1) = 1,250 kW</span>',
    '<span class="mn-src">CONV_CALC · upsLossKw · doc-09 line 39</span>':
      '<span class="mn-src">CONV_CALC v2.0.0 · upsLossKw</span>',
    '<span class="mn-eq">ΔT [°C] = CHWR − CHWS = 14.8 − 7.2 = 7.6 °C</span>':
      '<span class="mn-eq">ΔT [°C] = CHWR − CHWS = 27.0 − 19.4 = 7.6 °C</span>',
    '<span class="mn-src">CONV_CALC · chwDeltaT · doc-09 line 83</span>':
      '<span class="mn-src">CONV_CALC v2.0.0 · chwDeltaT</span>',
    '<span class="mn-eq">= 1,850 / (4.186 × 7.6) = 58.1 L/s</span>':
      '<span class="mn-eq">= 30,000 / (4.186 × 7.6) = 943.0 L/s</span>',
    '<span class="mn-src">CONV_CALC · chwFlowLps · doc-09 lines 81–85</span>':
      '<span class="mn-src">CONV_CALC v2.0.0 · chwFlowLps</span>',
    '<span class="mn-eq">CHW flow = IT load / (Cp × ΔT) → 1 850 / (4.186 × 7.6) = 58.1 L/s</span>':
      '<span class="mn-eq">= 30,000 / (4.186 × 7.6) = 943.0 L/s</span>',
    '<span class="mn-eq">Heat rejection = IT + UPS loss → 1 850 + 77.1 = 1 927.1 kW (sanity band 1 850–1 950)</span>':
      '<span class="mn-eq">Evaporator duty = IT + UPS loss = 30,000 + 1,250 = 31,250 kW</span>',
    '<span class="mn-eq">= (1.20 × 1,850) / 60 = 37.0 L/min</span>':
      '<span class="mn-eq">= (1.20 × 30,000) / 60 = 600 L/min</span>',
    '<span class="mn-eq">WUE check = (Flow × 60) / IT Load = (37.0 × 60) / 1,850 = 1.20 L/kWh ✓</span>':
      '<span class="mn-eq">WUE check = (600 × 60) / 30,000 = 1.20 L/kWh ✓</span>',
    '<span class="mn-src">CONV_CALC · waterFlowLpmForWue · doc-09 lines 99–104</span>':
      '<span class="mn-src">CONV_CALC v2.0.0 · waterFlowLpmForWue</span>',
    '<span class="mn-eq">= 2,682.5 × 0.42 = 1,126.7 kgCO₂/hr</span>':
      '<span class="mn-eq">= 43,500 × 0.42 = 18,270 kgCO₂/hr</span>',
    '<span class="mn-eq">= 60,000 × 0.90 × 0.85 = 45,900 L</span>':
      '<span class="mn-eq">= 972,737 × 0.90 × 0.85 = 744,144 L (rounded)</span>',
    '<span class="mn-eq">Autonomy [hr] = Usable Fuel / Consumption = 45,900 / 956 = 48.0 hr</span>':
      '<span class="mn-eq">Autonomy [hr] = Usable Fuel / Consumption = 744,144 / 15,503 = 48.0 hr</span>',
    '<span class="mn-src">CONV_CALC · fuelAutonomyHr · doc-09 lines 133–147</span>':
      '<span class="mn-src">CONV_CALC v2.0.0 · fuelAutonomyHr</span>',
    '<span class="mn-result">1,850.0 kW</span>': '<span class="mn-result">30,000 kW</span>',
    '<span class="mn-result">2,682.5 kW</span>': '<span class="mn-result">43,500 kW</span>',
    '<span class="mn-result">832.5 kW</span>': '<span class="mn-result">13,500 kW</span>',
    '<span class="mn-result">77.1 kW</span>': '<span class="mn-result">1,250 kW</span>',
    '<span class="mn-result">58.1 L/s</span>': '<span class="mn-result">943.0 L/s</span>',
    '<span class="mn-result">37.0 L/min</span>': '<span class="mn-result">600 L/min</span>',
    '<span class="mn-result">1,126.7 kgCO₂/hr</span>': '<span class="mn-result">18,270 kgCO₂/hr</span>',
    '<span class="mn-result">45,900 L</span>': '<span class="mn-result">744,144 L</span>',
    '<span class="mn-result">48.0 hr</span>': '<span class="mn-result">48.0 hr</span>',
    '<span class="mn-result">308 racks</span>': '<span class="mn-result">2,000 racks</span>',
    '<span class="mn-result">185 racks</span>': '<span class="mn-result">2,000 racks</span>',
    '<li><b>Engine source</b> — <code class="mn-mono">js/conv-engine.js</code> (CONV_CALC v1.0.0) — deep-frozen scenario object + pure derivation functions.</li>':
      '<li><b>Engine source</b> — <code class="mn-mono">js/conv-engine.js</code> (CONV_CALC v2.0.0) — deep-frozen current-operation and design-boundary snapshot.</li>',
    '<li><b>Accuracy gate</b> — <code class="mn-mono">tools/probe-accuracy-validation.mjs</code> (40/40 assertions) + <code class="mn-mono">tools/test-conv-calc.mjs</code> (22/22 DoD identities).</li>':
      '<li><b>Accuracy gates</b> — <code class="mn-mono">tools/test-conv-calc.mjs</code>, <code class="mn-mono">tools/test-conv-coverage.mjs</code>, and <code class="mn-mono">tools/test-conv-document-parity.mjs</code>.</li>',
    '<li><b>ASHRAE TC9.9 (2021)</b> — Thermal Guidelines for Data Processing Environments: cold-aisle temperature band (18–27 °C recommended), humidity 40–60 %RH, PUE/WUE benchmarks.</li>':
      '<li><b>ASHRAE Handbook — Data Centers and Telecommunication Facilities</b> — rack-inlet recommended dry-bulb envelope (18–27 °C for the applicable A classes) and class/dew-point-dependent humidity guidance. The project 25.4 °C target and 48% RH basis remain site decisions.</li>',
    '<li><b>Uptime Institute Tier Standard (2022)</b> — Tier III: N+1 redundancy, 72 hr fuel autonomy target; WUE benchmark scale (good: 1.0–1.4 L/kWh).</li>':
      '<li><b>Uptime Institute Tier Standard</b> — topology and concurrently-maintainable intent. No certification, universal fuel-duration target or WUE grading band is inferred by this cockpit.</li>',
  }),
});
const COCKPITS = Object.freeze([
  { file: 'EPMS_Telemetry.html', slug: 'epms-telemetry', buttonClass: 'btn' },
  { file: 'datahallAI.html', slug: 'datahallai', buttonClass: 'bbtn', existingManual: true },
  { file: 'dc-conventional.html', slug: 'dc-conventional', buttonClass: 'back-btn', existingManual: true },
  { file: 'datahall.html', slug: 'datahall', buttonClass: 'nav-btn', existingManual: true },
  { file: 'cdu-mini-bms.html', slug: 'cdu-mini-bms', buttonClass: 'nav-link' },
  { file: 'rz-cockpit-mockup.html', slug: 'rz-cockpit-mockup', buttonClass: 'sub' },
]);

function read(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function baseline(relativePath) {
  return execFileSync('git', ['show', `${BASELINE_REV}:${relativePath}`], { cwd: ROOT, encoding: 'utf8' });
}

function protectedManualFragments(html) {
  const fragments = [];
  const patterns = [
    /<span[^>]+class=["'][^"']*mn-(?:eq|result|src)[^"']*["'][^>]*>[\s\S]*?<\/span>/gi,
    /<li><b>[\s\S]*?<\/li>/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) fragments.push(match[0].replace(/\s+/g, ' ').trim());
  }
  return fragments;
}

function assertPublicDoc(html, relativePath) {
  assert.doesNotMatch(html, /enforceTierFeatureAccess|id=["']rootGate["']/, `${relativePath} must remain public`);
  assert.match(html, /<nav class=["']navbar["']/, `${relativePath} must use the site navbar`);
  assert.match(html, /:root:not\(\[data-theme=["']dark["']\]\)/, `${relativePath} needs safe light fallback`);
  assert.match(html, /@media\s*\(max-width:\s*768px\)/, `${relativePath} needs the mobile checkpoint`);
  assert.match(html, /data-explain(?:-scan)?/, `${relativePath} needs RZExplain hooks`);
  for (const source of REQUIRED_SCRIPTS) {
    assert.ok(html.includes(source), `${relativePath} must load ${source}`);
  }
  for (const source of REQUIRED_STYLES) {
    assert.ok(html.includes(source), `${relativePath} must load ${source}`);
  }
  assert.match(
    html,
    /fonts\.googleapis\.com\/css2\?family=IBM\+Plex\+Sans/i,
    `${relativePath} must load the canonical IBM Plex Sans font`,
  );
  assert.doesNotMatch(
    html,
    /['"]Inter['"]|family=Inter(?:&|%|\b)/i,
    `${relativePath} must use the canonical IBM Plex typography without the Inter AI-slop fallback`,
  );
  assert.doesNotMatch(
    html,
    /backdrop-filter\s*:|--glass-blur\s*:/i,
    `${relativePath} must not introduce decorative glassmorphism`,
  );
  assert.doesNotMatch(
    html,
    /border-radius\s*:\s*999(?:px)?/i,
    `${relativePath} must not use full-round pill styling`,
  );
  assert.doesNotMatch(
    html,
    /border-left\s*:\s*(?:[2-9]|[1-9]\d+)px\s+solid/i,
    `${relativePath} must use hairline borders instead of thick accent stripes`,
  );
}

function assertMetaDescription(html, relativePath) {
  const match = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  assert.ok(match, `${relativePath} needs a meta description`);
  assert.ok(match[1].length >= 120 && match[1].length <= 160,
    `${relativePath} description must be 120-160 characters, got ${match[1].length}`);
}

function countDocumentSections(html) {
  return [...html.matchAll(/<section\b[^>]*class=["']([^"']*)["'][^>]*>/gi)]
    .filter((match) => {
      const classes = match[1].split(/\s+/);
      return classes.includes('mn-section') && !classes.includes('mn-toc');
    }).length;
}

function assertPrd(slug) {
  const relativePath = `prd/${slug}.html`;
  assert.ok(existsSync(resolve(ROOT, relativePath)), `${relativePath} must exist`);
  const html = read(relativePath);
  assertPublicDoc(html, relativePath);
  assertMetaDescription(html, relativePath);
  assert.equal(countDocumentSections(html), 11,
    `${relativePath} must contain exactly 11 PRD sections`);
  assert.match(html, /FR-\d{2}/, `${relativePath} needs deterministic functional requirements`);
  assert.match(html, /AC-\d{2}/, `${relativePath} needs deterministic acceptance criteria`);
  assert.match(html, /<table[^>]*>[\s\S]*Unit[\s\S]*Source binding/i,
    `${relativePath} needs the telemetry-point table`);
  assert.match(html, /TechArticle/, `${relativePath} needs TechArticle JSON-LD`);
  assert.match(html, /BreadcrumbList/, `${relativePath} needs BreadcrumbList JSON-LD`);
}

function assertManual(slug) {
  const relativePath = `manual/${slug}.html`;
  assert.ok(existsSync(resolve(ROOT, relativePath)), `${relativePath} must exist`);
  const html = read(relativePath);
  assertPublicDoc(html, relativePath);
  assertMetaDescription(html, relativePath);
  assert.ok(countDocumentSections(html) >= 8,
    `${relativePath} needs at least eight structured manual sections`);
  for (const heading of ['engineering basis', 'calculation', 'worked example', 'standards', 'glossary']) {
    assert.match(html, new RegExp(heading, 'i'), `${relativePath} must cover ${heading}`);
  }
}

function assertCockpitButtons(cockpit) {
  const html = read(cockpit.file);
  for (const kind of ['prd', 'manual']) {
    const label = kind === 'prd' ? 'PRD' : 'Manual';
    const pattern = new RegExp(`<a[^>]+class=["'][^"']*${cockpit.buttonClass}[^"']*["'][^>]+href=["']${kind}/${cockpit.slug}\\.html["'][^>]*>${label}</a>`, 'gi');
    const matches = html.match(pattern) || [];
    assert.equal(
      matches.length,
      1,
      `${cockpit.file} must expose exactly one ${label} contract link`,
    );
  }
}

function assertExistingManualPreserved(cockpit) {
  if (!cockpit.existingManual) return;
  const relativePath = `manual/${cockpit.slug}.html`;
  const current = read(relativePath).replace(/\s+/g, ' ');
  const protectedFragments = protectedManualFragments(baseline(relativePath));
  const replacements = INTENTIONAL_MANUAL_REPLACEMENTS[cockpit.slug] || Object.freeze({});
  assert.ok(protectedFragments.length > 0, `${relativePath} baseline needs protected sourced fragments`);
  const missingFragments = protectedFragments.filter((fragment) => {
    const acceptedReplacement = replacements[fragment];
    return !current.includes(fragment) && !(acceptedReplacement && current.includes(acceptedReplacement));
  });
  assert.deepEqual(
    missingFragments,
    [],
    `${relativePath} removed or rewrote sourced formula/result/reference fragments without explicit replacement contracts`,
  );
}

function assertHubs() {
  const prdHub = read('prd/index.html');
  const manualHub = read('manual/index.html');
  for (const cockpit of COCKPITS) {
    assert.ok(prdHub.includes(`${cockpit.slug}.html`), `PRD hub must link ${cockpit.slug}`);
    assert.ok(manualHub.includes(`${cockpit.slug}.html`), `manual hub must link ${cockpit.slug}`);
  }
  assert.doesNotMatch(
    `${prdHub}\n${manualHub}`,
    /background\s*:\s*(?:linear|radial)-gradient/i,
    'documentation hubs must use flat instrument surfaces, not generic decorative gradients',
  );
  assert.doesNotMatch(
    `${prdHub}\n${manualHub}`,
    /border-left\s*:\s*(?:[2-9]|[1-9]\d+)px\s+solid/i,
    'documentation hubs must use hairline borders instead of thick accent stripes',
  );
}

function assertReleaseCriticalAssets() {
  const worker = read('sw.js');
  const auth = read('auth.js');
  assert.ok(worker.includes("'/auth.js'"), 'legacy workers must keep auth.js network-first');
  assert.match(auth, /function exposePublicContractLinks\(\)/,
    'network-first auth must bootstrap public contract links when navigation is stale');
  for (const asset of [
    '/js/rz-mobile-nav.js',
    '/js/rz-cookie-consent.js',
    '/js/rz-documentation-ui.js',
    '/js/rz-telemetry-quality.js',
    '/css/rz-cockpit-instrument.css',
    '/css/rz-documentation-ui.css',
  ]) {
    assert.ok(worker.includes(`'${asset}'`), `${asset} must bypass stale cache after this release`);
  }
}

function assertManualFabLockIsolation() {
  const manualFab = read('js/rz-manual-fab.js');
  assert.doesNotMatch(
    manualFab,
    /createElement\(['"]nav['"]\)/,
    'manual FAB landmark must not match body.locked > nav selectors',
  );
  assert.match(
    manualFab,
    /setAttribute\(['"]role['"],\s*['"]navigation['"]\)/,
    'manual FAB must retain navigation landmark semantics without a nav element',
  );
}

for (const cockpit of COCKPITS) {
  assertPrd(cockpit.slug);
  assertManual(cockpit.slug);
  assertCockpitButtons(cockpit);
  assertExistingManualPreserved(cockpit);
}
assertHubs();
assertReleaseCriticalAssets();
assertManualFabLockIsolation();
console.log(`telemetry docs contract: ${COCKPITS.length} cockpits, 12 docs, 12 unique contract links — PASS`);
