/* ============================================================================
 * dcai-engine.js — pure calculation engine for the AI / HPC campus (GB300)
 * ----------------------------------------------------------------------------
 * Reads js/dcai-model.js (authored leaves) and publishes ONE frozen snapshot in
 * which every quantity is derived. There is no typed kW anywhere in this file:
 * pumps come from flow x head, fans from airflow x static, the chiller COP from
 * a Carnot fraction over the actual temperature lift, and every equipment count
 * is ceil(duty / unit) plus a declared redundancy rule.
 *
 * WHAT THIS ENGINE DOES THAT THE GB200 ONE COULD NOT
 *   1. It has an OUTDOORS. The old engine charged a nameplate COP against 100 %
 *      of the heat with no economiser term, so the PUE could not respond to
 *      weather and landed at 1.30 regardless. Here the liquid path is free-cooled
 *      whenever ambient + dry-cooler approach <= TCS supply - CDU approach, and
 *      the engine publishes BOTH sides of that inequality and their margin.
 *   2. It states the cliff. Free cooling is a regime switch, not a gradient: the
 *      snapshot names the ambient at which the liquid path loses it, and the
 *      annual figure is bin-weighted across that switch rather than averaged.
 *   3. WUE and free cooling are consistent. The GB200 page showed WUE 0.00 AND a
 *      dry cooler leaving fluid COLDER than the air cooling it. Here the dry-only
 *      basis is enforced: no evaporative term exists, so WUE is 0 by construction
 *      and the approach is always positive.
 *
 * UNIT DISCIPLINE: `_kwth` thermal, `_kwe` electrical, `_c` Celsius, `_k` kelvin
 * difference, `_m3h` volume flow, `_m3s` where fans need it. Nothing adds a kwth
 * to a kwe. The balance test in tools/test-dcai-engine.mjs checks the sums.
 *
 * NOTHING IS TUNED. Every input was declared in the model before any PUE was
 * looked at, and the engine reports the gap to the 1.12 target rather than
 * closing it. Zero-build, ES5, window.DCAI_CALC + module.exports.
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

  function resolveModel(injected) {
    if (injected) { return injected; }
    if (root && root.DCAI_MODEL) { return root.DCAI_MODEL; }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('./dcai-model.js'); } catch (e) { /* fall through */ }
    }
    throw new Error('DCAI_MODEL not available');
  }

  /* ---- numeric guards ---------------------------------------------------- */
  function num(x, label) {
    var n = typeof x === 'number' ? x : parseFloat(x);
    if (!isFinite(n)) { throw new Error('Non-finite numeric input' + (label ? ' for ' + label : '') + ': ' + x); }
    return n;
  }
  function div(a, b, label) {
    var nb = num(b, label);
    if (nb === 0) { throw new Error('Division by zero' + (label ? ' in ' + label : '')); }
    return num(a, label) / nb;
  }
  function round(x, dp) {
    var f = Math.pow(10, dp == null ? 2 : dp);
    return Math.round(num(x) * f) / f;
  }
  var KELVIN = 273.15;   // STANDARD
  var G = 9.81;          // STANDARD m/s2

  /* ========================================================================
   * PRIMITIVE FORMULAS — each one dimensionally closed
   * ======================================================================*/

  /* Volume flow (m3/h) carrying Q (kW_th) at delta-T (K): Q*3600/(rho*cp*dT) */
  function flowM3h(qKwTh, rhoKgPerM3, cpKjPerKgK, deltaTK) {
    return div(num(qKwTh) * 3600, num(rhoKgPerM3) * num(cpKjPerKgK) * num(deltaTK), 'flowM3h');
  }

  /* Pump shaft-to-wire electrical kW: rho*g*Q*H / (eta_pump*eta_motor), Q in m3/s */
  function pumpKwe(flowM3hV, headM, rhoKgPerM3, etaPump, etaMotor) {
    var qM3s = div(flowM3hV, 3600);
    return div(num(rhoKgPerM3) * G * qM3s * num(headM), num(etaPump) * num(etaMotor) * 1000, 'pumpKwe');
  }

  /* Fan electrical kW: Q_air (m3/s) * dP (Pa) / (eta_fan*eta_motor) */
  function fanKwe(airM3s, staticPa, etaFan, etaMotor) {
    return div(num(airM3s) * num(staticPa), num(etaFan) * num(etaMotor) * 1000, 'fanKwe');
  }

  /* Air volume (m3/s) carrying Q (kW_th) at an airside rise (K) */
  function airM3s(qKwTh, rhoAir, cpAir, deltaTK) {
    return div(num(qKwTh), num(rhoAir) * num(cpAir) * num(deltaTK), 'airM3s');
  }

  /* Carnot-fraction COP over an evaporator/condenser refrigerant pair, clamped */
  function copFromLift(evapC, condC, carnotFraction, copMax) {
    var te = num(evapC) + KELVIN, tc = num(condC) + KELVIN;
    if (tc <= te) { throw new Error('Condenser must be warmer than evaporator (' + condC + ' <= ' + evapC + ')'); }
    var carnot = div(te, tc - te, 'carnot');
    return Math.min(num(copMax), num(carnotFraction) * carnot);
  }

  function ceilCount(duty, unit) { return Math.ceil(div(duty, unit, 'ceilCount')); }

  /* ========================================================================
   * ONE OPERATING POINT — everything at a given ambient dry-bulb
   * ======================================================================*/
  function operatingPoint(m, ambientDbC, fixed) {
    var t = m.thermal, h = m.hydraulics, eq = m.equipment;
    var amb = num(ambientDbC, 'ambient');

    /* --- planes P0..P4: the economiser inequality, both sides published --- */
    var dryCoolerLeavingC = amb + t.dryCoolerApproachK;                 // P2 achievable
    var htwRequiredC = t.tcsSupplyC - t.cduApproachK;                   // P3 demanded
    var freeCoolingMarginK = htwRequiredC - dryCoolerLeavingC;          // P4
    var liquidFreeCooling = freeCoolingMarginK >= 0;

    /* --- liquid path planes --- */
    var htwSupplyC = liquidFreeCooling ? dryCoolerLeavingC : htwRequiredC;   // P5
    var htwReturnC = htwSupplyC + t.htwDeltaTK;                              // P6
    var tcsSupplyC = t.tcsSupplyC;                                           // P7
    var tcsReturnC = tcsSupplyC + t.tcsDeltaTK;                              // P8

    /* --- air path planes --- */
    var airSupplyC = t.airSupplyC;                                           // P9
    var rackInletC = airSupplyC;                                             // P10 (contained, 0 K mixing)
    var airReturnC = airSupplyC + t.airsideDeltaTK;                          // P11
    var chwSupplyC = airSupplyC - t.chwCoilApproachK;                        // P12
    var chwReturnC = chwSupplyC + t.chwDeltaTK;                              // P13
    var cdwSupplyC = amb + t.dryCoolerApproachK;                             // P15 (dry-cooled condenser loop)
    var cdwReturnC = cdwSupplyC + t.cdwDeltaTK;                              // P16
    var condRefrigC = cdwReturnC + t.condApproachK;                          // P17
    var airEvapRefrigC = chwSupplyC - t.evapApproachK;                       // P14
    var copAir = copFromLift(airEvapRefrigC, condRefrigC, t.carnotFraction, t.copMax);   // P18
    /* liquid path chiller only exists when free cooling is lost */
    var liqEvapRefrigC = htwRequiredC - t.evapApproachK;
    var copLiquid = liquidFreeCooling ? null
      : copFromLift(liqEvapRefrigC, condRefrigC, t.carnotFraction, t.copMax);

    /* --- duties (kW_th) --- */
    var liquidHeat = fixed.liquidHeat_kwth;
    var airHeat = fixed.airHeat_kwth;
    var chillerAir_kwe = div(airHeat, copAir);
    var chillerLiquid_kwe = liquidFreeCooling ? 0 : div(liquidHeat, copLiquid);
    var condenserHeat_kwth = airHeat + chillerAir_kwe + (liquidFreeCooling ? 0 : liquidHeat + chillerLiquid_kwe);
    var dryCoolerDuty_kwth = condenserHeat_kwth + (liquidFreeCooling ? liquidHeat : 0);

    /* --- flows (m3/h) --- */
    var tcsFlow_m3h = flowM3h(liquidHeat, h.tcsFluidRhoKgPerM3, h.tcsFluidCpKjPerKgK, t.tcsDeltaTK);
    var htwFlow_m3h = flowM3h(liquidHeat, h.waterRhoKgPerM3, h.waterCpKjPerKgK, t.htwDeltaTK);
    var chwFlow_m3h = flowM3h(airHeat, h.waterRhoKgPerM3, h.waterCpKjPerKgK, t.chwDeltaTK);
    var cdwFlow_m3h = flowM3h(condenserHeat_kwth, h.waterRhoKgPerM3, h.waterCpKjPerKgK, t.cdwDeltaTK);
    var crahAir_m3s = airM3s(airHeat, h.airRhoKgPerM3, h.airCpKjPerKgK, t.airsideDeltaTK);
    var dryCoolerAir_m3s = airM3s(dryCoolerDuty_kwth, h.airRhoKgPerM3, h.airCpKjPerKgK, t.dryCoolerAirDeltaTK);

    /* --- electrical (kW_e), all from physics, none typed --- */
    var tcsPumps_kwe = pumpKwe(tcsFlow_m3h, h.tcsPumpHeadM, h.tcsFluidRhoKgPerM3, h.pumpEfficiency, h.pumpMotorEfficiency);
    var htwPumps_kwe = pumpKwe(htwFlow_m3h, h.htwPumpHeadM, h.waterRhoKgPerM3, h.pumpEfficiency, h.pumpMotorEfficiency);
    var chwPumps_kwe = pumpKwe(chwFlow_m3h, h.chwPumpHeadM, h.waterRhoKgPerM3, h.pumpEfficiency, h.pumpMotorEfficiency);
    var cdwPumps_kwe = pumpKwe(cdwFlow_m3h, h.cdwPumpHeadM, h.waterRhoKgPerM3, h.pumpEfficiency, h.pumpMotorEfficiency);
    var crahFans_kwe = fanKwe(crahAir_m3s, h.crahFanStaticPa, h.fanEfficiency, h.fanMotorEfficiency);
    var dryCoolerFans_kwe = fanKwe(dryCoolerAir_m3s, h.dryCoolerFanStaticPa, h.fanEfficiency, h.fanMotorEfficiency);
    var pumps_kwe = tcsPumps_kwe + htwPumps_kwe + chwPumps_kwe + cdwPumps_kwe;
    var fans_kwe = crahFans_kwe + dryCoolerFans_kwe;
    var chillers_kwe = chillerAir_kwe + chillerLiquid_kwe;
    var cooling_kwe = chillers_kwe + pumps_kwe + fans_kwe;

    var nonIt_kwe = cooling_kwe + fixed.upsLoss_kwe + fixed.distLoss_kwe + fixed.aux_kwe;
    var facility_kwe = fixed.totalIt_kwe + nonIt_kwe;
    var pue = div(facility_kwe, fixed.totalIt_kwe, 'pue');

    /* --- counts at this point --- */
    var chillersDuty_kwth = airHeat + (liquidFreeCooling ? 0 : liquidHeat);
    var chillersRunning = ceilCount(chillersDuty_kwth, eq.chiller.unitKwTh);
    var dryCoolersRunning = ceilCount(dryCoolerDuty_kwth, eq.dryCooler.unitKwTh);

    return {
      ambient_db_c: amb,
      liquid_free_cooling: liquidFreeCooling,
      planes: {
        p00_ambient_db_c: amb,
        p02_dry_cooler_leaving_c: dryCoolerLeavingC,
        p03_htw_required_c: htwRequiredC,
        p04_free_cooling_margin_k: freeCoolingMarginK,
        p05_htw_supply_c: htwSupplyC,
        p06_htw_return_c: htwReturnC,
        p07_tcs_supply_c: tcsSupplyC,
        p08_tcs_return_c: tcsReturnC,
        p09_air_supply_c: airSupplyC,
        p10_rack_inlet_c: rackInletC,
        p11_air_return_c: airReturnC,
        p12_chw_supply_c: chwSupplyC,
        p13_chw_return_c: chwReturnC,
        p14_air_evap_refrig_c: airEvapRefrigC,
        p15_cdw_supply_c: cdwSupplyC,
        p16_cdw_return_c: cdwReturnC,
        p17_cond_refrig_c: condRefrigC,
        p18_cop_air_path: copAir,
        p19_cop_liquid_path: copLiquid,
        p20_liquid_evap_refrig_c: liquidFreeCooling ? null : liqEvapRefrigC
      },
      heat: {
        liquid_kwth: liquidHeat,
        air_kwth: airHeat,
        condenser_kwth: condenserHeat_kwth,
        dry_cooler_duty_kwth: dryCoolerDuty_kwth
      },
      flows: {
        tcs_m3h: tcsFlow_m3h, htw_m3h: htwFlow_m3h, chw_m3h: chwFlow_m3h, cdw_m3h: cdwFlow_m3h,
        crah_air_m3s: crahAir_m3s, dry_cooler_air_m3s: dryCoolerAir_m3s
      },
      electrical: {
        chiller_air_kwe: chillerAir_kwe,
        chiller_liquid_kwe: chillerLiquid_kwe,
        chillers_kwe: chillers_kwe,
        tcs_pumps_kwe: tcsPumps_kwe, htw_pumps_kwe: htwPumps_kwe,
        chw_pumps_kwe: chwPumps_kwe, cdw_pumps_kwe: cdwPumps_kwe,
        pumps_kwe: pumps_kwe,
        crah_fans_kwe: crahFans_kwe, dry_cooler_fans_kwe: dryCoolerFans_kwe,
        fans_kwe: fans_kwe,
        cooling_kwe: cooling_kwe,
        ups_loss_kwe: fixed.upsLoss_kwe,
        dist_loss_kwe: fixed.distLoss_kwe,
        aux_kwe: fixed.aux_kwe,
        non_it_kwe: nonIt_kwe,
        total_it_kwe: fixed.totalIt_kwe,
        facility_kwe: facility_kwe
      },
      counts: {
        chillers_running: chillersRunning,
        dry_coolers_running: dryCoolersRunning
      },
      pue: pue
    };
  }

  /* ========================================================================
   * THE SNAPSHOT
   * ======================================================================*/
  function compute(m) {
    var f = m.facility, g = m.gb300, fb = m.fabric, eq = m.equipment, el = m.electrical, geo = m.geometry;

    /* --- compute inventory --- */
    var racksFacility = f.halls * f.racksPerHall;
    var traysPerRack = g.computeTrays;
    var gpuPerRack = g.computeTrays * g.gpuPerTray;
    var cpuPerRack = g.computeTrays * g.cpuPerTray;
    var nvswitchPerRack = g.nvswitchTrays * g.nvswitchPerTray;
    var compute = {
      racks_per_hall: f.racksPerHall,
      racks_facility: racksFacility,
      gpu_per_rack: gpuPerRack,
      cpu_per_rack: cpuPerRack,
      nvswitch_per_rack: nvswitchPerRack,
      gpu_per_hall: gpuPerRack * f.racksPerHall,
      gpu_facility: gpuPerRack * racksFacility,
      cpu_facility: cpuPerRack * racksFacility,
      nvswitch_facility: nvswitchPerRack * racksFacility,
      compute_trays_facility: traysPerRack * racksFacility,
      cx8_nics_facility: traysPerRack * g.cx8PerTray * racksFacility,
      bf3_dpus_facility: traysPerRack * g.bf3PerTray * racksFacility,
      cx8_bandwidth_pbs: div(traysPerRack * g.cx8PerTray * racksFacility * g.cx8Gbps, 1e6),
      gpu_memory_pb_facility: div(g.gpuMemoryTbPerRack * racksFacility, 1000),
      nvlink_per_gpu_gbs: g.nvlinkPerGpuGBs,
      nvlink_domain_tbs: g.nvlinkDomainTBs,
      racks_per_nvl72_domain: g.racksPerDomain
    };

    /* --- power: the IT stack, rack-only envelope made explicit --- */
    var rackItHall_kwe = f.racksPerHall * f.rackItKw;
    var rackIt_kwe = racksFacility * f.rackItKw;
    var fabricSwitches = racksFacility * fb.switchesPerRack;
    var fabric_kwe = fabricSwitches * fb.switchKw;
    var oob_kwe = racksFacility * fb.oobPerRack * fb.oobKw;
    var storageMgmt_kwe = rackIt_kwe * fb.storageMgmtFraction;
    var totalIt_kwe = rackIt_kwe + fabric_kwe + oob_kwe + storageMgmt_kwe;
    var shelfInstalled_kw = g.powerShelves * g.shelfKw;
    var shelvesDuty = ceilCount(f.rackItKw, g.shelfKw);
    var shelvesSpare = g.powerShelves - shelvesDuty;
    var symmetricHalf = g.powerShelves / 2;
    var power = {
      rack_it_kw: f.rackItKw,
      rack_it_hall_kwe: rackItHall_kwe,
      rack_it_facility_kwe: rackIt_kwe,
      rack_it_facility_mw: div(rackIt_kwe, 1000),
      nameplate_it_mw_label: f.nameplateItMw,
      it_envelope: f.itEnvelope,
      fabric_switches_facility: fabricSwitches,
      fabric_it_kwe: fabric_kwe,
      oob_it_kwe: oob_kwe,
      storage_mgmt_it_kwe: storageMgmt_kwe,
      total_it_kwe: totalIt_kwe,
      total_it_mw: div(totalIt_kwe, 1000),
      total_it_hall_kwe: div(totalIt_kwe, f.halls),
      /* per-rack power shelves — the redundancy the arithmetic actually allows */
      shelf_installed_kw: shelfInstalled_kw,
      shelves_duty: shelvesDuty,
      shelves_spare: shelvesSpare,
      shelf_redundancy_label: 'N+' + shelvesSpare,
      shelf_symmetric_redundancy_achievable: symmetricHalf * g.shelfKw >= f.rackItKw,
      psu_per_rack: g.powerShelves * g.psuPerShelf
    };

    /* --- heat split; everything outside the rack is air cooled --- */
    var upsLoss_kwe = totalIt_kwe * (div(1, eq.ups.efficiency) - 1);
    var distLoss_kwe = totalIt_kwe * (div(1, eq.transformer.distributionEfficiency) - 1);
    var aux_kwe = rackIt_kwe * el.auxFractionOfIt;
    var liquidHeat_kwth = rackIt_kwe * g.liquidCaptureRatio;
    var airHeat_kwth = rackIt_kwe * (1 - g.liquidCaptureRatio) + fabric_kwe + oob_kwe + storageMgmt_kwe
                     + upsLoss_kwe + distLoss_kwe + aux_kwe;
    var fixed = {
      totalIt_kwe: totalIt_kwe, liquidHeat_kwth: liquidHeat_kwth, airHeat_kwth: airHeat_kwth,
      upsLoss_kwe: upsLoss_kwe, distLoss_kwe: distLoss_kwe, aux_kwe: aux_kwe
    };

    /* --- design point + weather bins --- */
    var design = operatingPoint(m, m.thermal.designAmbientDbC, fixed);
    var cliffAmbientC = m.thermal.tcsSupplyC - m.thermal.cduApproachK - m.thermal.dryCoolerApproachK;
    var bins = [], hoursTotal = 0, freeHours = 0, facilityKwh = 0, itKwh = 0, worst = null;
    for (var i = 0; i < m.weather.bins.length; i++) {
      var b = m.weather.bins[i];
      var op = operatingPoint(m, b.ambientDbC, fixed);
      hoursTotal += b.hours;
      if (op.liquid_free_cooling) { freeHours += b.hours; }
      facilityKwh += op.electrical.facility_kwe * b.hours;
      itKwh += totalIt_kwe * b.hours;
      if (!worst || op.pue > worst.pue) { worst = op; }
      bins.push({
        ambient_db_c: b.ambientDbC, hours: b.hours,
        liquid_free_cooling: op.liquid_free_cooling,
        free_cooling_margin_k: op.planes.p04_free_cooling_margin_k,
        pue: op.pue,
        facility_kwe: op.electrical.facility_kwe,
        chillers_running: op.counts.chillers_running
      });
    }
    var annualPue = div(facilityKwh, itKwh, 'annual pue');

    /* --- equipment counts: ceil(duty/unit) + declared redundancy --- */
    var liquidHeatHall_kwth = div(liquidHeat_kwth, f.halls);
    var airHeatHall_kwth = div(airHeat_kwth, f.halls);
    var cduDutyHall = ceilCount(liquidHeatHall_kwth, eq.cdu.unitKwTh);
    var crahDutyHall = ceilCount(airHeatHall_kwth, eq.crah.unitKwTh);
    var chillersDesign = design.counts.chillers_running;
    var chillersWorst = worst ? worst.counts.chillers_running : chillersDesign;
    var dryCoolersDesign = design.counts.dry_coolers_running;
    var dryCoolersWorst = worst ? worst.counts.dry_coolers_running : dryCoolersDesign;
    /* frames per feed at or below the design-loading ceiling; 2N doubles it */
    var upsFramesPerFeed = ceilCount(totalIt_kwe, eq.ups.unitKw * eq.ups.designLoadingMax);
    var facilityKva = div(design.electrical.facility_kwe, el.powerFactor);
    var transformers = ceilCount(facilityKva, eq.transformer.unitMva * 1000);
    var gensetsDuty = ceilCount(worst ? worst.electrical.facility_kwe : design.electrical.facility_kwe, eq.generator.unitKw);
    var battery_kwh = div(div(totalIt_kwe * eq.ups.runtimeMin, 60), eq.ups.usableDoD * eq.ups.inverterEfficiency);
    var equipment = {
      cdu_unit_kwth: eq.cdu.unitKwTh,
      cdu_model: eq.cdu.model,
      cdu_duty_per_hall: cduDutyHall,
      cdu_installed_per_hall: cduDutyHall + 1,
      cdu_installed_facility: (cduDutyHall + 1) * f.halls,
      cdu_flow_check_m3h: div(design.flows.tcs_m3h, f.halls),
      cdu_published_flow_m3h: div(liquidHeatHall_kwth * eq.cdu.publishedLpmPerKw * 60, 1000),
      crah_unit_kwth: eq.crah.unitKwTh,
      crah_duty_per_hall: crahDutyHall,
      crah_installed_per_hall: crahDutyHall + 1,
      crah_installed_facility: (crahDutyHall + 1) * f.halls,
      chiller_unit_kwth: eq.chiller.unitKwTh,
      chillers_running_design: chillersDesign,
      chillers_running_worst_bin: chillersWorst,
      chillers_installed: chillersWorst + 1,
      dry_cooler_unit_kwth: eq.dryCooler.unitKwTh,
      dry_coolers_running_design: dryCoolersDesign,
      dry_coolers_installed: dryCoolersWorst + 1,
      ups_frame_kw: eq.ups.unitKw,
      ups_topology: eq.ups.topology,
      ups_frames_per_feed: upsFramesPerFeed,
      ups_frames_total: upsFramesPerFeed * 2,
      ups_loading_pct: div(totalIt_kwe, upsFramesPerFeed * eq.ups.unitKw) * 100,
      battery_kwh: battery_kwh,
      transformer_unit_mva: eq.transformer.unitMva,
      facility_kva: facilityKva,
      transformers: transformers,
      generator_unit_kw: eq.generator.unitKw,
      generator_model: eq.generator.model,
      gensets_duty: gensetsDuty,
      gensets_installed: gensetsDuty + 2,
      generator_redundancy: eq.generator.redundancy
    };

    /* --- compute fabric per hall (radix arithmetic, integer by construction) --- */
    var gpuHall = compute.gpu_per_hall;
    /* radix and port splits are MODEL leaves (fabric.*) so the registry can measure them */
    var leafRadix = fb.leafRadix, leafDown = fb.leafDownPorts, leafUp = fb.leafUpPorts,
        spineDown = fb.spineDownPorts, spineUp = fb.spineUpPorts;
    var leaves = div(gpuHall, leafDown);
    var leafUplinks = leaves * leafUp;
    var spines = div(leafUplinks, spineDown);
    var spineUplinks = spines * spineUp;
    var cores = div(spineUplinks, leafRadix);
    var network = {
      leaf_radix: leafRadix,
      leaves_per_hall: leaves,
      spines_per_hall: spines,
      cores_per_hall: cores,
      switches_per_hall: leaves + spines + cores,
      switches_per_rack_check: div(leaves + spines + cores, f.racksPerHall),
      gpu_downlinks_per_hall: gpuHall,
      leaf_spine_links_per_hall: leafUplinks,
      spine_core_links_per_hall: spineUplinks,
      integer_topology: Number.isInteger(leaves) && Number.isInteger(spines) && Number.isInteger(cores)
    };

    /* --- geometry --- */
    var hallArea = geo.lengthM * geo.widthM;
    var racksPerRow = div(f.racksPerHall, geo.rows, 'racks per row');
    var racksPerGroup = el.racksPerRppGroup;
    var groupsPerHall = div(f.racksPerHall, racksPerGroup, 'groups per hall');
    /* Published as a FLAG, not a throw: the registry generator perturbs every leaf by x1.37 and
       x0.73 to measure dependencies, and a throw there would erase the edges of everything
       downstream of racksPerHall. The gate asserts the flag is true on the shipped model. */
    var integerLayout = Number.isInteger(racksPerRow) && Number.isInteger(groupsPerHall);
    var geometry = {
      integer_layout: integerLayout,
      hall_length_m: geo.lengthM, hall_width_m: geo.widthM, hall_height_m: geo.heightM,
      rack_rows: geo.rows,
      racks_per_row: racksPerRow,
      rack_groups_per_hall: groupsPerHall,
      racks_per_group: racksPerGroup,
      groups_per_row: div(racksPerRow, racksPerGroup, 'groups per row'),
      hall_area_m2: hallArea,
      hall_volume_m3: hallArea * geo.heightM,
      rack_footprint_m2_per_hall: f.racksPerHall * geo.rackFootprintM2,
      rack_footprint_fraction: div(f.racksPerHall * geo.rackFootprintM2, hallArea),
      it_density_kw_per_m2: div(rackItHall_kwe, hallArea)
    };

    /* --- LV distribution: the group a busway trunk actually carries --- */
    var SQRT3 = 1.7320508075688772;   // STANDARD
    var groupKw = racksPerGroup * f.rackItKw;
    var groupCurrentA = div(groupKw * 1000, SQRT3 * el.voltageLL * el.powerFactor, 'group current');
    var rackFeedA = div(f.rackItKw * 1000, SQRT3 * el.voltageLL * el.powerFactor, 'rack feed current');
    var distribution = {
      voltage_ll_v: el.voltageLL,
      power_factor: el.powerFactor,
      rack_feed_current_a: rackFeedA,
      rack_feed_current_per_cord_a: div(rackFeedA, 2),        // dual-corded A/B, each cord sized for the full load
      group_kw: groupKw,
      group_current_a: groupCurrentA,
      busway_trunk_a: el.buswayTrunkA,
      busway_loading_pct: div(groupCurrentA, el.buswayTrunkA) * 100,
      busway_trunk_fits_group: groupCurrentA <= el.buswayTrunkA,
      rpp_groups_per_hall: groupsPerHall,
      rack_feed_dual_corded: true,                             // A + B cord per rack, each sized for full load
      hall_group_kw_check: groupKw * groupsPerHall === rackItHall_kwe,   // groups x group kW closes to the hall rack IT
      rpp_per_hall: groupsPerHall * 2,                         // A + B per group
      transformers_per_hall_per_feed: Math.ceil(div(transformers, f.halls * 2)),
      ups_frames_per_hall_per_feed: Math.ceil(div(upsFramesPerFeed, f.halls)),
      gensets_facility_shared: true                            // the engine has no per-hall genset split
    };

    /* --- PUE, honestly --- */
    var band = m.pueDesignBand;
    var pue = {
      design_day: design.pue,
      annual_bin_weighted: annualPue,
      worst_bin: worst ? worst.pue : design.pue,
      worst_bin_ambient_c: worst ? worst.ambient_db_c : design.ambient_db_c,
      target: band.target,
      band_min: band.min,
      band_max: band.max,
      design_in_band: design.pue >= band.min && design.pue <= band.max,
      gap_to_target: design.pue - band.target,
      free_cooling_cliff_ambient_c: cliffAmbientC,
      free_cooling_hours: freeHours,
      hours_total: hoursTotal,
      free_cooling_fraction: div(freeHours, hoursTotal),
      /* the rack-IT-basis figure some datasheets quote; a DIFFERENT denominator, labelled */
      design_day_rack_it_basis: div(design.electrical.facility_kwe, rackIt_kwe),
      /* CUE_IT (ISO/IEC 30134-8) = grid factor x PUE; the 0.69 was nine page literals */
      grid_kg_co2_per_kwh: el.gridKgCo2PerKwh,
      cue_it_kg_per_kwh: el.gridKgCo2PerKwh * design.pue,
      annual_basis: m.weather.basis,
      largest_non_it_term: largestTerm(design.electrical)
    };

    var wue = {
      l_per_kwh: 0,
      mode: 'Dry-only heat rejection — no evaporative term exists in this model',
      consistent_with_free_cooling: true,
      annual_site_water_m3: 0
    };

    return deepFreeze({
      meta: {
        engine: 'dcai-engine.js',
        version: '1.0.0',
        spec_version: m.specVersion,
        authority: m.authority,
        evidence_class: 'SIMULATED/ADOPTED',
        nameplate_evidence_class: 'ASSUMED',
        annual_evidence_class: 'ASSUMED',
        basis: 'Adopted GB300 campus scenario — simulated, not measured telemetry',
        retired_basis: 'js/datahall-model.js + js/datahall-calculations.js (GB200, 14.256 MW) — frozen, tested, retired'
      },
      compute: compute,
      power: power,
      heat: { liquid_kwth: liquidHeat_kwth, air_kwth: airHeat_kwth,
              liquid_hall_kwth: liquidHeatHall_kwth, air_hall_kwth: airHeatHall_kwth,
              liquid_capture_ratio: g.liquidCaptureRatio },
      design: design,
      bins: bins,
      equipment: equipment,
      distribution: distribution,
      network: network,
      geometry: geometry,
      pue: pue,
      wue: wue
    });
  }

  function largestTerm(e) {
    var terms = [
      ['ups_loss_kwe', e.ups_loss_kwe], ['dist_loss_kwe', e.dist_loss_kwe], ['aux_kwe', e.aux_kwe],
      ['chillers_kwe', e.chillers_kwe], ['pumps_kwe', e.pumps_kwe],
      ['crah_fans_kwe', e.crah_fans_kwe], ['dry_cooler_fans_kwe', e.dry_cooler_fans_kwe]
    ];
    var best = terms[0];
    for (var i = 1; i < terms.length; i++) { if (terms[i][1] > best[1]) { best = terms[i]; } }
    return { term: best[0], kwe: best[1], share_of_non_it: div(best[1], e.non_it_kwe) };
  }

  /* ========================================================================
   * PUBLIC API
   * ======================================================================*/
  function build(injected) {
    var model = resolveModel(injected);
    var snapshot = compute(model);
    var api = {
      model: model,
      snapshot: snapshot,
      compute: function (m) { return compute(m || model); },
      /* the same physics at an arbitrary ambient — for the weather slider and the gates */
      operatingPoint: function (ambientDbC, m) {
        var mm = m || model;
        var s = mm === model ? snapshot : compute(mm);
        return operatingPoint(mm, ambientDbC, {
          totalIt_kwe: s.power.total_it_kwe, liquidHeat_kwth: s.heat.liquid_kwth, airHeat_kwth: s.heat.air_kwth,
          upsLoss_kwe: s.design.electrical.ups_loss_kwe, distLoss_kwe: s.design.electrical.dist_loss_kwe,
          aux_kwe: s.design.electrical.aux_kwe
        });
      },
      /* primitives, exported so a page can show its arithmetic */
      flowM3h: flowM3h, pumpKwe: pumpKwe, fanKwe: fanKwe, airM3s: airM3s, copFromLift: copFromLift,
      ceilCount: ceilCount, round: round,
      round1: function (x) { return round(x, 1); },
      round2: function (x) { return round(x, 2); }
    };
    api.build = build;   /* lets a test inject a perturbed model into vm */
    return deepFreeze(api);
  }

  var DCAI_CALC = build();
  if (root) { root.DCAI_CALC = DCAI_CALC; }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DCAI_CALC;
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
