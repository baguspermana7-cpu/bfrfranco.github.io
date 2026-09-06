/* ============================================================================
 * dcai-model.js — AUTHORED basis for the AI / HPC data-centre cockpit (GB300)
 * ----------------------------------------------------------------------------
 * This file holds LEAVES ONLY: every number here is typed by a person, carries a
 * `// source:` line and an evidence class, and nothing here is computed. All
 * arithmetic lives in js/dcai-engine.js, which reads this object and publishes
 * a frozen snapshot. The split is what makes the parameter registry honest —
 * the generator perturbs these leaves and records which published quantities
 * move, so "derived" is measured rather than asserted.
 *
 * WHY A NEW PAIR OF FILES
 * -----------------------
 * js/datahall-model.js + js/datahall-calculations.js are the GB200-era basis
 * (4 halls x 27 NVL72 domains x 132 kW = 14.256 MW). They are FROZEN — the ship
 * gate refuses any byte change to them — and tools/test-datahall-calc.mjs keeps
 * proving 57/57 that they still reproduce their own worked examples. The owner
 * asked for a 300-500 MW AI campus on the newest NVIDIA rack (2026-09-05), which
 * is a different basis, not a parameter change. ACCURACY_VALIDATION records the
 * GB200 pair as RETIRED the way conv-engine.js records the 1.85 MW hall.
 *
 * EVIDENCE CLASSES USED HERE (nothing may claim MEASURED — this is a simulation)
 *   PUBLISHED  — printed by the vendor / standard body, URL or document named
 *   ADOPTED    — an owner or project design decision, stated as such
 *   ASSUMED    — a textbook or mid-band engineering value chosen BEFORE the
 *                result was looked at; the softest inputs are flagged in-line
 *   STANDARD   — a physical constant or a code value
 *   LABEL      — a name, never a denominator (Rule 4)
 *
 * OWNER DECISIONS (2026-09-05, recorded in plan cheerful-cuddling-mitten.md)
 *   - IT 300-500 MW, four halls, NVL72-class racks at 100-140 kW or newer.
 *   - "500 MW" is RACK IT, not the total envelope -> it_envelope 'rack-only'.
 *   - "yang terbaik" on cooling basis -> warm TCS, DRY-ONLY heat rejection, so
 *     the WUE 0.00 the cockpit already displays becomes true.
 *   - "jangan dibuat-buat": nothing is tuned to reach a PUE. The PUE is whatever
 *     the declared terms produce, and the engine publishes the gap to target.
 *
 * Zero-build, ES5, no imports. window.DCAI_MODEL + module.exports.
 * ==========================================================================*/
(function (root) {
  'use strict';

  function deepFreeze(obj) {
    if (obj === null || typeof obj !== 'object') { return obj; }
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      var v = obj[keys[i]];
      if (v && typeof v === 'object' && !Object.isFrozen(v)) { deepFreeze(v); }
    }
    return Object.freeze(obj);
  }

  var MODEL = {
    specVersion: 'gb300-500mw-2026-09-06',
    authority: 'Owner decisions 2026-09-05 (plan cheerful-cuddling-mitten.md, Track A) + NVIDIA GB300 NVL72 public page + DGX SuperPOD GB300 reference architecture',

    /* ------------------------------------------------------------------------
     * FACILITY SCALE
     * ----------------------------------------------------------------------*/
    facility: {
      // source: owner 2026-09-05 "datahallnya dibuat 4 aja" — ADOPTED
      halls: 4,
      // source: plan Track A §A2 — 880 keeps all four halls identical AND divides by
      //         the 4-rack rail group, so the fabric arithmetic stays integer. 3,522
      //         (the figure that lands exactly on 500.1 MW) does neither. ADOPTED
      racksPerHall: 880,
      // source: NVIDIA GB300 NVL72 public page states no rack power. Bounds that ARE
      //         published: 8 power shelves x 33 kW = 264 kW installed (DGX GB300 RA
      //         "Power Shelves"); one Scalable Unit of 8 racks = 1.2 MW TDP incl. fabric
      //         (RA "DGX SuperPOD Architecture") = 150 kW/rack all-in. 142 kW sits inside
      //         both and is the figure the market quotes for the rack alone. ADOPTED —
      //         a design value, NOT an official rating. Owner asked for 100-140 kW or
      //         more advanced; this is the more advanced end.
      rackItKw: 142,
      // source: owner 2026-09-05 "at least 300MW-500MW". LABEL ONLY — the computed rack
      //         figure is 880 x 4 x 142 = 499.84 MW and THAT is the denominator (Rule 4).
      nameplateItMw: 500,
      // source: owner decision 2026-09-05 (AskUserQuestion): "500 MW = rack IT". ADOPTED
      itEnvelope: 'rack-only'
    },

    /* ------------------------------------------------------------------------
     * NVIDIA GB300 NVL72 — one rack is one NVLink domain
     * ----------------------------------------------------------------------*/
    gb300: {
      // source: DGX GB300 RA "Each DGX GB300 rack is built with 18 compute trays and 9
      //         NVLink switch trays" — PUBLISHED
      computeTrays: 18,
      nvswitchTrays: 9,
      // source: RA "72 GPUs in a single NVLink domain" per DGX GB300 rack system — one rack IS
      //         the NVL72 domain. The GB200 basis split a domain over 2 physical racks. PUBLISHED
      racksPerDomain: 1,
      // source: RA "Each compute tray contains two GB300 Superchips, and each Superchip
      //         has two B300 GPUs and one Grace CPU" — PUBLISHED (4 GPU + 2 CPU / tray)
      gpuPerTray: 4,
      cpuPerTray: 2,
      // source: RA "Each NVLink switch tray is equipped with 2 NVLink switch chips" — PUBLISHED
      nvswitchPerTray: 2,
      // source: RA "delivering a total bandwidth of 1.8 TB/s" per GPU (18 NVL5 links) — PUBLISHED
      nvlinkPerGpuGBs: 1800,
      // source: nvidia.com/en-us/data-center/gb300-nvl72 "130 TB/s" NVLink domain — PUBLISHED
      nvlinkDomainTBs: 130,
      // source: nvidia.com GB300 NVL72 page "20 TB" total GPU memory per rack — PUBLISHED
      gpuMemoryTbPerRack: 20,
      // source: RA "The compute tray integrates four ConnectX-8 NICs ... 800Gbps" — PUBLISHED
      cx8PerTray: 4,
      cx8Gbps: 800,
      // source: RA "one BlueField-3 NICs to support 2x400Gbps" (BF3240) — PUBLISHED
      bf3PerTray: 1,
      bf3Gbps: 800,
      // source: RA "six 5.5kW PSUs configured as N redundant and can deliver up to 33kW
      //         ... eight total power shelves in a single DGX GB300 NVL72 rack" — PUBLISHED
      powerShelves: 8,
      shelfKw: 33,
      psuPerShelf: 6,
      psuKw: 5.5,
      // source: BASELINE-DECISION.md (GB200 basis) "Liquid capture | 85%", carried over —
      //         the RA says GPUs/CPUs are liquid cooled and "other components are air
      //         cooled" but publishes no split. ADOPTED
      liquidCaptureRatio: 0.85
    },

    /* ------------------------------------------------------------------------
     * IT OUTSIDE THE RACK — the part "500 MW rack IT" deliberately excludes
     * ----------------------------------------------------------------------*/
    fabric: {
      // source: plan §A7 — 4 rails, QM3400 radix 144, leaf 1:1, 2:1 at tier 3 gives
      //         880 leaves + 660 spines + 220 cores = 1,760 switches/hall = exactly 2 per
      //         rack. ADOPTED topology.
      switchesPerRack: 2,
      // source: no vendor figure adopted; a 144-port 800G IB switch class draws 2-4 kW.
      //         4 kW is the CONSERVATIVE end. ASSUMED — the softest input in the electrical
      //         stack; it alone decides ~28 MW of the 539 MW total. Sensitivity published.
      switchKw: 4,
      // source: one management switch per fabric switch (RA: SN2201 OOB per rack + BMC
      //         ports). 150 W is a 1U management switch class. ASSUMED
      oobPerRack: 2,
      oobKw: 0.15,
      // source: storage + management nodes as a fraction of rack IT. 2% is a training-hall
      //         planning allowance, not a sized system. ASSUMED
      storageMgmtFraction: 0.02,
      // source: RA "enhanced port radix of 144 port for Q3400-RD Quantum-X800 switches". PUBLISHED
      leafRadix: 144,
      // source: leaf split 72 down / 72 up (1:1, non-blocking at the rack); spine 96 down / 48
      //         up (2:1 at tier 3). Plan §A7 adopted topology; the RA's own SuperPOD fabric is
      //         two-layer and does not reach this scale. ADOPTED
      leafDownPorts: 72,
      leafUpPorts: 72,
      spineDownPorts: 96,
      spineUpPorts: 48
    },

    /* ------------------------------------------------------------------------
     * THERMAL CHAIN — authored planes only; every other plane is derived
     * ----------------------------------------------------------------------*/
    thermal: {
      // source: owner decision "yang terbaik" 2026-09-05 -> warm TCS so the liquid path
      //         can run dry. The GB300 public page does not print an inlet envelope;
      //         40 C is ASHRAE W40 class. ADOPTED
      tcsSupplyC: 40,
      // source: BASELINE-DECISION.md (GB200) "35 / 45 C (delta-T 10 K)" — the delta is
      //         carried over; the level moved. ADOPTED
      tcsDeltaTK: 10,
      // source: CoolIT CHx1000 is rated 1,000 kW AT A 3 C APPROACH (coolitsystems.com/
      //         product/chx1000). The CDU sizing unit below IS that unit, so its approach
      //         is the plane's approach. PUBLISHED (for the unit) / ADOPTED (as the plane)
      cduApproachK: 3,
      // source: dry-cooler leaving-fluid approach to ambient dry-bulb. 3 K is a large
      //         finned-coil selection at design airflow. ASSUMED
      dryCoolerApproachK: 3,
      // source: Jakarta ASHRAE 0.4 % design dry-bulb class is ~34 C; the cockpit's own
      //         PDF already cites "Outdoor design wet-bulb (Jakarta) 28 C". ADOPTED —
      //         verify against the station table before Basis-of-Design sign-off.
      designAmbientDbC: 34,
      designWetBulbC: 28,
      // source: ASHRAE TC 9.9 A1 recommended upper inlet 27 C; contained cold aisle,
      //         2 K margin -> 25 C supply. ADOPTED
      airSupplyC: 25,
      // source: sensible CHW coil approach, no vendor coil selected. ASSUMED (same value
      //         and same status as conv-engine.js CHW_COIL_APPROACH_K)
      chwCoilApproachK: 6,
      // source: CHW design delta-T for a warm-water air path. ADOPTED
      chwDeltaTK: 8,
      // source: rack airside rise, contained aisle (conv-engine.js AIRSIDE_DELTA_T_K). ADOPTED
      airsideDeltaTK: 11,
      // source: facility (HTW) loop delta-T across the CDU plate HX. ADOPTED
      htwDeltaTK: 8,
      // source: condenser-water delta-T, dry-cooled condenser loop. ADOPTED
      cdwDeltaTK: 6,
      // source: evaporator and condenser refrigerant-to-water approaches. ASSUMED
      evapApproachK: 2,
      condApproachK: 3,
      // source: fraction of Carnot achieved by a modern centrifugal at design. ASSUMED —
      //         published machines land 0.5-0.6; this is the middle, chosen BEFORE any
      //         PUE was computed.
      carnotFraction: 0.55,
      // source: no real chiller runs above this at a warm evaporator; a ceiling so the
      //         Carnot expression cannot produce a fantasy COP on a 5 K lift. ASSUMED
      copMax: 12,
      // source: dry-cooler airside temperature rise across the coil. ASSUMED
      dryCoolerAirDeltaTK: 8
    },

    /* ------------------------------------------------------------------------
     * HYDRAULICS AND FANS — affinity-law inputs, not typed kW
     * ----------------------------------------------------------------------*/
    hydraulics: {
      // source: standard water properties at 40 C class. STANDARD
      waterRhoKgPerM3: 1000,
      waterCpKjPerKgK: 4.186,
      // source: 30 % PG in the TCS loop lowers cp and raises rho. ASSUMED fluid choice;
      //         property values are handbook (STANDARD).
      tcsFluidRhoKgPerM3: 1020,
      tcsFluidCpKjPerKgK: 3.9,
      // source: dry air at 30 C class. STANDARD
      airRhoKgPerM3: 1.16,
      airCpKjPerKgK: 1.006,
      // source: pump total head per loop class — TCS (short, in-row) 25 m; HTW and CHW
      //         (plant loops with plate HX / coils) 35 m; CDW (condenser) 30 m. ASSUMED
      tcsPumpHeadM: 25,
      htwPumpHeadM: 35,
      chwPumpHeadM: 35,
      cdwPumpHeadM: 30,
      // source: end-suction / split-case pump at design duty, 0.75. ASSUMED
      pumpEfficiency: 0.75,
      // source: IE3/IE4 class motor at 75-250 kW, 0.94. ASSUMED
      pumpMotorEfficiency: 0.94,
      // source: dry-cooler external static, axial fans, 150 Pa. ASSUMED — the SOFTEST input in
      //         the whole cooling model: across its credible 100-250 Pa range it moves PUE by
      //         ~0.03. Published as a sensitivity, never hidden.
      dryCoolerFanStaticPa: 150,
      // source: CRAH total static across coil + filter + containment, 250 Pa. ASSUMED
      crahFanStaticPa: 250,
      // source: EC plug / axial fan total efficiency, 0.65. ASSUMED
      fanEfficiency: 0.65,
      // source: EC fan motor + drive efficiency, 0.92. ASSUMED
      fanMotorEfficiency: 0.92
    },

    /* ------------------------------------------------------------------------
     * EQUIPMENT UNITS — counts are ceil(duty / unit) + a declared redundancy rule
     * ----------------------------------------------------------------------*/
    equipment: {
      cdu: {
        // source: coolitsystems.com/product/chx1000 — 1,000 kW @ 3 C approach, 1.5 LPM/kW.
        //         PUBLISHED (the only CDU in this model with a published flow rule)
        model: 'CoolIT CHx1000 (row CDU)',
        unitKwTh: 1000,
        publishedLpmPerKw: 1.5,
        redundancy: 'N+1 per hall'
      },
      crah: {
        // source: no vendor selection. 200 kW sensible is a large-frame CRAH class. ASSUMED
        model: 'Large-frame CRAH, CHW coil',
        unitKwTh: 200,
        redundancy: 'N+1 per hall'
      },
      chiller: {
        // source: 4,000 kW class water-cooled centrifugal (Carrier 19DV range tops at
        //         4,044 kW per the GB200 basis Source-Sanity). ASSUMED unit size
        model: 'Water-cooled centrifugal, 4 MW class',
        unitKwTh: 4000,
        redundancy: 'N+1'
      },
      dryCooler: {
        // source: V-bank dry cooler, 1,000 kW class at 3 K approach. ASSUMED
        model: 'V-bank dry cooler, 1 MW class',
        unitKwTh: 1000,
        redundancy: 'N+1'
      },
      ups: {
        // source: 1,250 kW modular UPS frame; 2N A/B carried from the GB200 basis. ASSUMED
        model: 'Modular UPS, 1.25 MW frame, 2N A/B',
        unitKw: 1250,
        topology: '2N',
        // source: double-conversion efficiency at design load. ASSUMED
        efficiency: 0.965,
        // source: frames are selected so the design load sits at or below 80 % of the
        //         installed per-feed capacity — a sizing convention, not a PUE lever. The
        //         first engine run sized frames at 99.8 % loading, which no Basis-of-Design
        //         would accept; this is the input that was missing. ASSUMED
        designLoadingMax: 0.8,
        // source: battery runtime, usable depth of discharge, inverter efficiency. ASSUMED
        runtimeMin: 5,
        usableDoD: 0.8,
        inverterEfficiency: 0.95
      },
      transformer: {
        // source: 2.5 MVA cast-resin unit substation. ASSUMED
        model: 'Cast-resin unit substation transformer',
        unitMva: 2.5,
        // source: downstream distribution efficiency (transformer + busway + PDU). ASSUMED
        distributionEfficiency: 0.988
      },
      generator: {
        // source: the GB200 basis carried Cat 3516E at 2,750 kW; at 500 MW that is >200
        //         machines — the wrong class. A 4 MW MV set is the campus-scale class.
        //         ASSUMED unit; no model named because none was selected.
        model: '4 MW class MV diesel generator',
        unitKw: 4000,
        redundancy: 'N+2'
      }
    },

    /* ------------------------------------------------------------------------
     * ELECTRICAL BASIS
     * ----------------------------------------------------------------------*/
    electrical: {
      // source: BASELINE-DECISION.md (GB200) 400 V / PF 0.96 — carried. ADOPTED
      voltageLL: 400,
      powerFactor: 0.96,
      // source: auxiliary + balance-of-plant as a fraction of IT (lighting, controls,
      //         security, offices). ASSUMED
      auxFractionOfIt: 0.0035,
      // source: plan Track A §WP2 electrical design — the LV grouping unit comes from
      //         ampacity, not taste. A whole row (88 x 142 kW = 12.5 MW) cannot hang on one
      //         LV trunk and a half row (6.25 MW ~ 9.4 kA at 400 V) has no busway; a
      //         quarter row of 22 racks is 3.12 MW ~ 4.7 kA, which the 5,000 A trunk below
      //         carries. 22 also divides 88 and 880 exactly, so the grouping is integer in
      //         both directions. ADOPTED
      racksPerRppGroup: 22,
      // source: 5,000 A is a standard cast-resin LV busway trunk rating class; it is the
      //         smallest standard rating above the 4,697 A group current. ADOPTED — no
      //         vendor selected, so the rating is a class, not a product.
      buswayTrunkA: 5000
    },

    /* ------------------------------------------------------------------------
     * HALL GEOMETRY
     * ----------------------------------------------------------------------*/
    geometry: {
      // source: 880 racks x 0.6 x 1.2 m = 634 m2 of rack footprint; a 1:3 footprint-to-
      //         floor ratio for hot/cold aisles, CDUs, CRAHs and egress. ADOPTED
      lengthM: 62,
      widthM: 31,
      heightM: 5.5,
      // source: plan Track A §WP2 — 10 rows at a 3.1 m pitch fills the 31 m width, and
      //         88 racks at 0.6 m fills 52.8 m of the 62 m length with a cross-aisle.
      //         10 x 88 = 880 exactly, so the floor grid is integer. ADOPTED
      rows: 10,
      // source: NVIDIA GB300 NVL72 design guide rack footprint class 600 x 1200 mm. ADOPTED
      rackFootprintM2: 0.72
    },

    /* ------------------------------------------------------------------------
     * WEATHER — annual dry-bulb bins for the annual PUE
     * ----------------------------------------------------------------------*/
    weather: {
      // source: SHAPED for a tropical lowland site around the 34 C design point. NOT a
      //         TMY. Hours sum to 8,760. ASSUMED — until a TMY file exists, every annual
      //         figure downstream is ASSUMED and says so.
      basis: 'ASSUMED — shaped bins, not a TMY file',
      bins: [
        { ambientDbC: 24, hours: 600 },
        { ambientDbC: 26, hours: 1400 },
        { ambientDbC: 28, hours: 2200 },
        { ambientDbC: 30, hours: 2300 },
        { ambientDbC: 32, hours: 1500 },
        { ambientDbC: 34, hours: 600 },
        { ambientDbC: 36, hours: 160 }
      ]
    },

    /* PUE design band — a TARGET, never a denominator or a fudge (Rule 4). */
    // source: BASELINE-DECISION.md "PUE (design) | 1.12 - 1.25", carried. LABEL/TARGET
    pueDesignBand: { min: 1.12, max: 1.25, target: 1.12 }
  };

  deepFreeze(MODEL);

  if (root) { root.DCAI_MODEL = MODEL; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = MODEL; }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
