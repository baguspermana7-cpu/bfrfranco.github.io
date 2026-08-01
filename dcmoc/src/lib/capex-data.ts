
/* ─── DELEGATION STATUS vs shared RZEngine v2.3.0 (see CapexEngine.ts) ──────
 * FALLBACK-ONLY (engine DATA.capexDetail wins at calc time when loaded):
 *   redundancyMultipliers, coolingMultipliers, rackMultipliers,
 *   buildingMultipliers, seismicMultipliers, fireSuppressionMultipliers,
 *   fireAlarmMultipliers, upsMultipliers, genMultipliers,
 *   yearEscalation (engine: plain number), substationCosts (engine: plain number).
 * STAYS LOCAL (DCMOC finer-grained / different model shape — SUPER_ENGINE §Z.3):
 *   costFactors (A7 2025 bases; engine provenance: NOT merged), cityData,
 *   locationMultipliers, permitRegionMult, testingRedundancyMult,
 *   equipmentBrands.
 * ──────────────────────────────────────────────────────────────────────── */

// A7: Updated CAPEX base costs to 2025 market rates ($/kW)
// Sources: Turner & Townsend 2025, C&W 2025, JLL Construction Benchmark
export const costFactors = {
    building: { base: 1050, label: 'Building & Civil', icon: 'building', color: '#64748b' },
    seismic: { base: 130, label: 'Seismic Protection', icon: 'mountain', color: '#78716c' },
    electrical: { base: 1550, label: 'Electrical (MV/LV)', icon: 'zap', color: '#3b82f6' },
    ups: { base: 780, label: 'UPS Systems', icon: 'battery-charging', color: '#22d3ee' },
    generator: { base: 520, label: 'Generator & Fuel', icon: 'fuel', color: '#f59e0b' },
    cooling: { base: 900, label: 'Cooling Systems', icon: 'snowflake', color: '#06b6d4' },
    fireSuppression: { base: 195, label: 'Fire Suppression', icon: 'fire-extinguisher', color: '#ef4444' },
    fireAlarm: { base: 105, label: 'Fire Alarm System', icon: 'bell', color: '#f97316' },
    bms: { base: 160, label: 'BMS / DCIM', icon: 'monitor', color: '#10b981' },
    network: { base: 325, label: 'Network Infra', icon: 'network', color: '#a855f7' },
    security: { base: 105, label: 'Security Systems', icon: 'shield', color: '#6366f1' },
    commissioning: { base: 155, label: 'Cx Agent & Startup', icon: 'clipboard-check', color: '#14b8a6' },
    testing: { base: 115, label: 'Testing & Compliance', icon: 'award', color: '#0ea5e9' },
    permits: { base: 80, label: 'Permits & Approvals', icon: 'file-text', color: '#84cc16' }
};

export const redundancyMultipliers: Record<string, number> = { n: 1.0, n1: 1.25, '2n': 1.85, '2n1': 2.1 };
export const coolingMultipliers: Record<string, number> = { air: 1.0, inrow: 1.2, rdhx: 1.35, liquid: 1.6, immersion_1p: 1.8, immersion_2p: 2.0, microfluidic: 2.2 };
/* `ultra`/`inert`/`sprinkler`/`beam` = DCMOC UI option values aliased to their
 * engineering equivalents (ai / inergen IG-541 / wet-pipe water) + beam premium
 * so a select never silently falls back to 1.0 (audit fix — mirrors engine
 * DATA.capexDetail; DCMOC reads the engine map first, this is the fallback twin). */
export const rackMultipliers: Record<string, number> = { standard: 1.0, medium: 1.1, high: 1.3, ai: 1.6, ultra: 1.9 };
export const buildingMultipliers: Record<string, number> = { warehouse: 0.7, modular: 0.85, purpose: 1.0, highrise: 1.4 };
export const seismicMultipliers: Record<string, number> = { zone0: 0.2, zone1: 1.0, zone2: 2.5, zone3: 5.0, zone4: 8.0 };
export const fireSuppressionMultipliers: Record<string, number> = { fm200: 1.0, novec: 1.3, inergen: 1.2, n2: 1.8, water: 0.6, inert: 1.2, sprinkler: 0.6 };
export const fireAlarmMultipliers: Record<string, number> = { conventional: 0.6, addressable: 1.0, vesda: 1.8, hybrid: 2.2, beam: 1.2 };
export const upsMultipliers: Record<string, number> = { standalone: 0.9, modular: 1.0, distributed: 1.2, rotary: 1.5 };
export const genMultipliers: Record<string, number> = { diesel: 1.0, gas: 1.15, dualfuel: 1.3, hvo: 1.2 };
/* Quality/site/market factors (screening) — wire the previously-dead FOM selects.
 * Each defaults to 1.0 at the UI default option (baseline unchanged); mirrors
 * engine DATA.capexDetail. DCMOC reads the engine map first, this is the twin. */
export const distributionMultipliers: Record<string, number> = { busway: 1.0, cable_tray: 0.97, overhead: 0.94, underfloor: 1.0 };
export const pduMultipliers: Record<string, number> = { basic: 0.97, monitored: 1.0, switched: 1.02, intelligent: 1.05 };
export const cablingMultipliers: Record<string, number> = { cat6a: 1.0, cat8: 1.03, fiber_om4: 1.05, fiber_sm: 1.07 };
export const floorMultipliers: Record<string, number> = { raised: 1.0, slab: 0.96, raised_600: 1.0, raised_1000: 1.03 };
export const securityMultipliers: Record<string, number> = { basic: 0.97, standard: 1.0, enhanced: 1.04, military: 1.10 };
export const fiberEntryMultipliers: Record<string, number> = { single: 1.0, dual: 1.02, mmr: 1.03 };
export const siteConditionMultipliers: Record<string, number> = { greenfield: 1.0, brownfield: 1.05, retrofit: 1.08 };
export const marketConditionMultipliers: Record<string, number> = { favorable: 0.95, normal: 1.0, tight: 1.06, overheated: 1.12 };
export const txLeadMultipliers: Record<string, number> = { standard: 1.0, expedited: 1.03, long_lead: 1.0 };
export const txTypeMultipliers: Record<string, number> = { dry: 1.0, oil: 0.95 };
export const deliveryMethodMultipliers: Record<string, number> = { design_build: 1.0, design_bid_build: 1.02, epc: 1.04 };
// DM audit: legacy coarse REGION map — FALLBACK ONLY. CapexEngine location priority is
// COUNTRIES[id].constructionIndex (now filled 40/40 in constants/countries.ts, T&T ICMS/RLB
// screening rel. US=1.0) > cityData perW > this map (CapexEngine.ts:131-143).
export const locationMultipliers: Record<string, number> = { sea: 0.65, india: 0.55, china: 0.7, japan: 1.1, australia: 1.05, europe: 1.15, usa: 1.0, mena: 0.85, africa: 0.55, south_america: 0.6, south_korea: 0.95, taiwan: 0.8 };

export const cityData: Record<string, { perW: number; region: string; label: string; source: string }> = {
    silicon_valley: { perW: 13.30, region: 'usa', label: 'Silicon Valley', source: 'T&T 2025' },
    new_jersey: { perW: 12.90, region: 'usa', label: 'New Jersey/NYC', source: 'C&W 2025' },
    virginia: { perW: 13.40, region: 'usa', label: 'Virginia/NOVA', source: 'C&W 2025' },
    dallas: { perW: 14.30, region: 'usa', label: 'Dallas, TX', source: 'C&W 2025' },
    phoenix: { perW: 13.40, region: 'usa', label: 'Phoenix, AZ', source: 'C&W 2025' },
    chicago: { perW: 13.20, region: 'usa', label: 'Chicago, IL', source: 'C&W 2025' },
    san_antonio: { perW: 9.30, region: 'usa', label: 'San Antonio, TX', source: 'C&W 2025' },
    london: { perW: 12.00, region: 'europe', label: 'London', source: 'T&T 2025' },
    frankfurt: { perW: 11.60, region: 'europe', label: 'Frankfurt', source: 'T&T 2025' },
    amsterdam: { perW: 11.80, region: 'europe', label: 'Amsterdam', source: 'Est. T&T' },
    stockholm: { perW: 10.50, region: 'europe', label: 'Stockholm', source: 'Est. T&T' },
    tokyo: { perW: 15.20, region: 'japan', label: 'Tokyo', source: 'T&T 2025' },
    singapore: { perW: 14.53, region: 'sea', label: 'Singapore', source: 'T&T 2025' },
    hong_kong: { perW: 13.80, region: 'china', label: 'Hong Kong', source: 'Est. T&T' },
    seoul: { perW: 9.50, region: 'south_korea', label: 'Seoul', source: 'C&W APAC' },
    sydney: { perW: 12.30, region: 'australia', label: 'Sydney', source: 'Est. T&T' },
    malaysia: { perW: 11.37, region: 'sea', label: 'Malaysia/Johor', source: 'T&T 2025' },
    jakarta: { perW: 11.21, region: 'sea', label: 'Jakarta', source: 'T&T 2025' },
    mumbai: { perW: 6.64, region: 'india', label: 'Mumbai', source: 'T&T 2025' },
    bangkok: { perW: 8.50, region: 'sea', label: 'Bangkok', source: 'Est. APAC' },
    // ─── NEW: Middle East ──────────────────────────
    dubai: { perW: 10.50, region: 'mena', label: 'Dubai', source: 'CBRE MENA 2025' },
    abu_dhabi: { perW: 9.80, region: 'mena', label: 'Abu Dhabi', source: 'Est. MENA' },
    riyadh: { perW: 9.20, region: 'mena', label: 'Riyadh', source: 'CBRE MENA 2025' },
    jeddah: { perW: 8.80, region: 'mena', label: 'Jeddah', source: 'Est. MENA' },
    doha: { perW: 10.20, region: 'mena', label: 'Doha', source: 'Est. MENA' },
    // ─── NEW: Africa ───────────────────────────────
    johannesburg: { perW: 7.50, region: 'africa', label: 'Johannesburg', source: 'Est. Africa' },
    cape_town: { perW: 7.80, region: 'africa', label: 'Cape Town', source: 'Est. Africa' },
    lagos: { perW: 8.00, region: 'africa', label: 'Lagos', source: 'Est. Africa' },
    nairobi: { perW: 7.20, region: 'africa', label: 'Nairobi', source: 'Est. Africa' },
    // ─── NEW: Latin America ────────────────────────
    sao_paulo: { perW: 8.50, region: 'south_america', label: 'São Paulo', source: 'Est. LatAm' },
    rio_de_janeiro: { perW: 8.20, region: 'south_america', label: 'Rio de Janeiro', source: 'Est. LatAm' },
    santiago: { perW: 7.80, region: 'south_america', label: 'Santiago', source: 'Est. LatAm' },
    queretaro: { perW: 7.00, region: 'south_america', label: 'Querétaro', source: 'Est. LatAm' },
    mexico_city: { perW: 7.50, region: 'south_america', label: 'Mexico City', source: 'Est. LatAm' },
    bogota: { perW: 7.30, region: 'south_america', label: 'Bogotá', source: 'Est. LatAm' },
    // ─── NEW: Expanded APAC ────────────────────────
    chennai: { perW: 6.30, region: 'india', label: 'Chennai', source: 'T&T 2025' },
    hyderabad: { perW: 6.00, region: 'india', label: 'Hyderabad', source: 'Est. India' },
    beijing: { perW: 9.50, region: 'china', label: 'Beijing', source: 'Est. China' },
    shanghai: { perW: 10.00, region: 'china', label: 'Shanghai', source: 'Est. China' },
    osaka: { perW: 13.80, region: 'japan', label: 'Osaka', source: 'Est. Japan' },
    surabaya: { perW: 9.50, region: 'sea', label: 'Surabaya', source: 'Est. Indonesia' },
    batam: { perW: 9.00, region: 'sea', label: 'Batam', source: 'Est. Indonesia' },
    ho_chi_minh: { perW: 7.50, region: 'sea', label: 'Ho Chi Minh City', source: 'Est. Vietnam' },
    manila: { perW: 8.00, region: 'sea', label: 'Manila', source: 'Est. Philippines' },
    taipei: { perW: 11.00, region: 'taiwan', label: 'Taipei', source: 'Est. Taiwan' },
    auckland: { perW: 11.50, region: 'australia', label: 'Auckland', source: 'Est. NZ' },
    melbourne: { perW: 11.90, region: 'australia', label: 'Melbourne', source: 'Est. Australia' },
    // ─── NEW: Expanded EMEA ────────────────────────
    dublin: { perW: 11.50, region: 'europe', label: 'Dublin', source: 'T&T 2025' },
    paris: { perW: 11.20, region: 'europe', label: 'Paris', source: 'Est. Europe' },
    marseille: { perW: 10.50, region: 'europe', label: 'Marseille', source: 'Est. Europe' },
    warsaw: { perW: 8.50, region: 'europe', label: 'Warsaw', source: 'Est. Europe' },
    milan: { perW: 10.80, region: 'europe', label: 'Milan', source: 'Est. Europe' },
    madrid: { perW: 10.20, region: 'europe', label: 'Madrid', source: 'Est. Europe' },
    manchester: { perW: 10.80, region: 'europe', label: 'Manchester', source: 'Est. UK' },
};

// Escalation from 2025 baseline; 2026 already absorbs ~5% supply/labor cost increase
// Sources: T&T 2025 Global Construction Index, JLL Market Outlook 2026
export const yearEscalation: Record<string, { mult: number; note: string }> = {
    '2025': { mult: 1.000, note: 'Baseline (T&T / C&W 2025 data)' },
    '2026': { mult: 1.050, note: '+5.0% — AI-driven switchgear/copper demand premium' },
    '2027': { mult: 1.100, note: '+4.8% — T&T 2026 trend, supply normalising' },
    '2028': { mult: 1.148, note: '+4.3% — partial supply chain normalization' },
    '2029': { mult: 1.190, note: '+3.7% — approaching long-run average' },
    '2030': { mult: 1.228, note: '+3.2% — historical average construction escalation' }
};

export const substationCosts: Record<string, { base: number; label: string }> = {
    shared: { base: 1000000, label: 'Shared Utility' },
    pad_mounted_11kv: { base: 2000000, label: 'Pad-Mounted 11kV' },
    dedicated_33kv: { base: 4000000, label: 'Dedicated 33kV' },
    dedicated_66kv: { base: 5500000, label: 'Dedicated 66kV' },
    dedicated_132kv: { base: 7500000, label: 'Dedicated 132kV+' }
};

export const equipmentBrands = {
    ups: {
        standalone: [
            { brand: 'Eaton', model: '93PM', range: '30-500 kVA', efficiency: '97.4%', note: 'Hot-swappable modules' },
            { brand: 'Vertiv', model: 'Liebert EXL S1', range: '100-1200 kVA', efficiency: '97%', note: 'Scalable architecture' },
            { brand: 'Schneider', model: 'Galaxy VX', range: '500-1500 kVA', efficiency: '97%', note: 'Lithium-ion compatible' }
        ],
        modular: [
            { brand: 'Vertiv', model: 'Trinergy Cube', range: '200-3600 kVA', efficiency: '98.5%', note: '3-mode operation' },
            { brand: 'ABB', model: 'MegaFlex DPA', range: '200-4800 kVA', efficiency: '97.6%', note: 'Decentralized parallel' },
            { brand: 'Huawei', model: 'UPS5000-H', range: '50-800 kVA/module', efficiency: '97.5%', note: 'AI-powered management' }
        ],
        distributed: [
            { brand: 'Schneider', model: 'Symmetra PX', range: '16-500 kVA', efficiency: '97%', note: 'Rack-mount modular' },
            { brand: 'Vertiv', model: 'Liebert APM', range: '30-600 kVA', efficiency: '96%', note: 'Mixed-capacity modules' },
            { brand: 'Eaton', model: '9PXM', range: '4-20 kVA', efficiency: '97%', note: 'Hot-swap batteries' }
        ],
        rotary: [
            { brand: 'Hitec', model: 'PowerProtection UNIBLOCK', range: '300-3000 kVA', efficiency: '97%', note: 'Diesel rotary, no batteries' },
            { brand: 'Piller', model: 'UNIBLOCK', range: '400-3300 kVA', efficiency: '96%', note: 'Kinetic energy storage' },
            { brand: 'Rolls-Royce', model: 'DRUPS', range: '500-3000 kW', efficiency: '95%', note: 'Integrated diesel flywheel' }
        ]
    },
    cooling: {
        air: [
            { brand: 'Vertiv', model: 'Liebert PFH', range: '24-252 kW', note: 'Perimeter CRAH with EC fans' },
            { brand: 'Schneider', model: 'InRow RD', range: '21-50 kW', note: 'Close-coupled, variable speed' },
            { brand: 'Stulz', model: 'CyberAir 3PRO', range: '6-200 kW', note: 'Free cooling capable' }
        ],
        inrow: [
            { brand: 'Vertiv', model: 'Liebert XDC', range: '35-80 kW', note: 'Rear-intake, variable capacity' },
            { brand: 'Schneider', model: 'InRow RD', range: '21-50 kW/row', note: 'Hot/cold aisle containment' },
            { brand: 'Stulz', model: 'CoolRow', range: '10-50 kW', note: 'Direct expansion or chilled water' }
        ],
        rdhx: [
            { brand: 'CoolIT', model: 'Rack DCHX', range: '30-80 kW/rack', note: 'Passive rear-door, no fans' },
            { brand: 'Vertiv', model: 'Liebert RDHx', range: '10-40 kW/rack', note: 'Zero rack footprint' },
            { brand: 'Motivair', model: 'ChilledDoor', range: '50-100 kW/rack', note: 'Active cooling, high density' }
        ],
        liquid: [
            { brand: 'CoolIT', model: 'DLC Manifold', range: '100+ kW/rack', note: 'CPU/GPU direct-to-chip' },
            { brand: 'GRC', model: 'ICEtank', range: 'Full immersion', note: 'Single-phase immersion' },
            { brand: 'LiquidCool', model: 'LCS2', range: '200+ kW/rack', note: 'Two-phase immersion cooling' }
        ]
    },
    generator: {
        diesel: [
            { brand: 'Caterpillar', model: 'C175-16', range: '2-3.5 MW', note: 'Tier 4F / EPA compliant' },
            { brand: 'Cummins', model: 'QSK95', range: '2.2-3.5 MW', note: 'Modular power nodes' },
            { brand: 'MTU', model: 'Series 4000', range: '0.5-3.25 MW', note: 'Compact footprint, low emissions' }
        ],
        gas: [
            { brand: 'Caterpillar', model: 'CG260-16', range: '2-4.5 MW', note: 'Natural gas, CHP capable' },
            { brand: 'Jenbacher', model: 'Type 6', range: '2-4.4 MW', note: 'High efficiency gas engine' },
            { brand: 'Wärtsilä', model: '34SG', range: '4-18 MW', note: 'Multi-fuel smart power' }
        ],
        dualfuel: [
            { brand: 'Wärtsilä', model: '34DF', range: '4-18 MW', note: 'Gas primary, diesel backup' },
            { brand: 'MAN', model: '51/60DF', range: '8-18 MW', note: 'Dual-fuel marine-grade' },
            { brand: 'Caterpillar', model: 'CG260DF', range: '2-4 MW', note: 'Seamless fuel switching' }
        ],
        hvo: [
            { brand: 'Cummins', model: 'QSK78 HVO', range: '2-3 MW', note: 'Drop-in HVO/renewable diesel' },
            { brand: 'Caterpillar', model: 'C175 HVO', range: '2-3.5 MW', note: '90% CO₂ reduction' },
            { brand: 'MTU', model: '4000 HVO', range: '1-3 MW', note: 'Certified for 100% HVO' }
        ]
    },
    fire: {
        fm200: { agent: 'HFC-227ea', density: '0.57 kg/m³', discharge: '10 sec', note: 'Being phased out (high GWP 3220)' },
        novec: { agent: 'FK-5-1-12', density: '0.51 kg/m³', discharge: '10 sec', note: 'GWP=1, zero ODP, safest choice' },
        inergen: { agent: 'IG-541 (N₂/Ar/CO₂)', density: '43.7%', discharge: '60 sec', note: 'Infinite atmospheric life, no residue' },
        n2: { agent: 'N₂', density: '12-15% O₂', discharge: 'Continuous', note: 'Prevents ignition, sealed rooms only' },
        water: { agent: 'High-pressure mist', density: '50-120 bar', discharge: 'Zoned', note: 'Green, no chemicals, NFPA 750' }
    }
};

export const permitRegionMult: Record<string, { permits: number; testing: number; label: string }> = {
    sea: { permits: 1.3, testing: 0.8, label: 'PUPR/BKPM permits, AMDAL, SLF, PLN approval' },
    india: { permits: 1.4, testing: 0.7, label: 'MoEF clearance, CEA, state DISCOM, fire NOC' },
    china: { permits: 1.5, testing: 0.9, label: 'NDRC approval, environmental impact, fire bureau' },
    japan: { permits: 1.8, testing: 1.5, label: 'Building Standards Act, fire prevention, seismic cert' },
    australia: { permits: 1.6, testing: 1.3, label: 'DA/CC approval, NCC compliance, fire safety' },
    europe: { permits: 1.7, testing: 1.4, label: 'EIA, energy efficiency directive, CE marking' },
    usa: { permits: 1.0, testing: 1.0, label: 'AHJ permits, NFPA 75/76, UL/ETL listing' },
    mena: { permits: 1.4, testing: 1.0, label: 'Civil Defence, municipality approvals, utility connects' },
    africa: { permits: 1.3, testing: 0.7, label: 'Environmental Impact, municipal permits, utility approval' },
    south_america: { permits: 1.3, testing: 0.8, label: 'Environmental license, utility agreements, zoning' },
    south_korea: { permits: 1.5, testing: 1.3, label: 'KCA, fire safety, building safety cert' },
    taiwan: { permits: 1.4, testing: 1.1, label: 'Taipower approval, building permit, fire safety' },
};

export const testingRedundancyMult: Record<string, number> = { n: 0.7, n1: 1.0, '2n': 1.5, '2n1': 1.8 };

/* ─── Ship-A — cosmetic breakdown meta for arch-driven cost lines ──────────────
 * LOCAL cosmetic only (label/icon/color for the CAPEX breakdown UI). The dollar
 * VALUE comes from the shared engine (coolingKitUsdPerRack × racks). Matches the
 * costFactors {label,icon,color} shape so the dashboard can render it uniformly. */
export const archExtraCostMeta: Record<string, { label: string; icon: string; color: string }> = {
    coolingKit: { label: 'AI Cooling Kit', icon: 'droplets', color: '#0ea5e9' },
};
