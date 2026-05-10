/**
 * @file pln-energy-data.js
 * @module PLN_ENERGY_DATA
 * @version 2026-05-01-v3
 *
 * Static representative energy data for the PLN Java-Bali Grid Monitor dashboard
 * (resistancezero.com). Loaded via <script src="js/pln-energy-data.js"></script>
 * AFTER js/pln-java-grid-data.js and BEFORE the page IIFE.
 *
 * Exposes:
 *   window.PLN_ENERGY_DATA  — static snapshot, fuel mix, 24h profile, annual history,
 *                             province tables, and records.
 *   window.PLN_ENERGY_DATA.computeProvinceAggregates(plnGrid)
 *                           — computes ProvinceAggregate[] from window.PLN_JAVA_GRID.
 *
 * Data anchors: PLN Annual Report 2024, RUPTL 2025-2034.
 * Schema: standarization/PLN_DATA_SCHEMA.md — see Section 6 for ProvinceAggregate.
 *
 * No imports. No build step. Vanilla ES6 (const/let/arrow). Global namespace pattern.
 */

(function (win) {
  'use strict';

  /* =========================================================
   * 1. HOURLY 24-HOUR PROFILE BUILDER
   *
   * Indonesia is an evening-peak grid (~18:30-20:00).
   * Demand shape (MW):
   *   00-03  night low   ~22 000
   *   04-07  morning     ~24 000-26 500
   *   08-12  midday      ~27 500-28 500
   *   13-17  afternoon   ~27 000-28 000
   *   18-20  peak        ~31 000-32 000
   *   21-23  decline     ~28 000-24 000
   *
   * By-fuel dispatch (MW):
   *   coal:       baseload 17 000 → 21 000 (peak)
   *   gas:        flexible 3 000 → 10 000 (peak)
   *   hydro:      ramps evening 1 200 → 2 500
   *   geothermal: flat baseload ~1 400
   *   solar:      bell 06-18, peak ~700 MW at noon, 0 at night
   *   biomass:    flat baseload ~600 MW
   *   diesel:     peaker — 0 most hours, up to 800 MW in peak (18-20)
   * ========================================================= */

  /**
   * Clamp a value between lo and hi.
   * @param {number} v
   * @param {number} lo
   * @param {number} hi
   * @returns {number}
   */
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  /**
   * Build a single hourly record.
   * Fuel values are balanced so their sum equals demand_mw (within 1 MW via gas trim).
   *
   * @param {number} hour          0-23
   * @param {number} demand        MW total demand at that hour
   * @param {number} coal          MW from coal
   * @param {number} hydro         MW from hydro
   * @param {number} geo           MW from geothermal
   * @param {number} solar         MW from solar
   * @param {number} biomass       MW from biomass
   * @param {number} diesel        MW from diesel (peaker)
   * @returns {{hour: number, demand_mw: number, by_fuel: Object}}
   */
  function makeHour(hour, demand, coal, hydro, geo, solar, biomass, diesel) {
    // Gas fills the remainder to keep sum == demand exactly
    var gas = demand - coal - hydro - geo - solar - biomass - diesel;
    return {
      hour: hour,
      demand_mw: demand,
      by_fuel: {
        coal:       Math.round(coal),
        gas:        Math.round(gas),
        hydro:      Math.round(hydro),
        geothermal: Math.round(geo),
        solar:      Math.round(solar),
        biomass:    Math.round(biomass),
        diesel:     Math.round(diesel)
      }
    };
  }

  /**
   * Solar bell-curve: returns MW output for given hour.
   * Active 06:00-18:00, peak ~700 MW at noon.
   * @param {number} hour
   * @returns {number}
   */
  function solarMW(hour) {
    if (hour < 6 || hour >= 18) return 0;
    // Gaussian-ish: peak at hour 12 (midday)
    var offset = hour - 12;
    return Math.round(700 * Math.exp(-(offset * offset) / 18));
  }

  /* Build all 24 hourly entries.
   * Numbers calibrated so:
   *   night low ~22 000 at 03:00
   *   morning ramp ~25 000 at 07:00
   *   midday ~28 000 at 12:00
   *   evening peak ~32 000 at 19:00
   *   late-night ~24 000 at 23:00
   */
  var hourly24h = [
    // hour, demand, coal, hydro, geo, solar, biomass, diesel
    makeHour( 0, 22400, 17000, 1200, 1400, solarMW( 0), 600,   0),
    makeHour( 1, 21900, 16800, 1200, 1400, solarMW( 1), 600,   0),
    makeHour( 2, 21500, 16500, 1200, 1400, solarMW( 2), 600,   0),
    makeHour( 3, 21200, 16300, 1200, 1400, solarMW( 3), 600,   0),
    makeHour( 4, 21600, 16500, 1200, 1400, solarMW( 4), 600,   0),
    makeHour( 5, 22800, 17000, 1250, 1400, solarMW( 5), 600,   0),
    makeHour( 6, 24500, 17500, 1300, 1400, solarMW( 6), 600,   0),
    makeHour( 7, 26000, 17800, 1400, 1400, solarMW( 7), 600,   0),
    makeHour( 8, 27200, 18000, 1500, 1400, solarMW( 8), 600,   0),
    makeHour( 9, 27800, 18200, 1550, 1400, solarMW( 9), 600,   0),
    makeHour(10, 28200, 18400, 1600, 1400, solarMW(10), 600,   0),
    makeHour(11, 28400, 18500, 1650, 1400, solarMW(11), 600,   0),
    makeHour(12, 28400, 18500, 1700, 1400, solarMW(12), 600,   0),
    makeHour(13, 28200, 18400, 1650, 1400, solarMW(13), 600,   0),
    makeHour(14, 28000, 18300, 1600, 1400, solarMW(14), 600,   0),
    makeHour(15, 27800, 18200, 1550, 1400, solarMW(15), 600,   0),
    makeHour(16, 28200, 18300, 1600, 1400, solarMW(16), 600,   0),
    makeHour(17, 29800, 19000, 1800, 1400, solarMW(17), 600,   0),
    makeHour(18, 31200, 19800, 2200, 1400, solarMW(18), 600, 200),
    makeHour(19, 32000, 20500, 2400, 1400, solarMW(19), 600, 800),
    makeHour(20, 31500, 20200, 2500, 1400, solarMW(20), 600, 800),
    makeHour(21, 29500, 19500, 2000, 1400, solarMW(21), 600, 400),
    makeHour(22, 27000, 18500, 1700, 1400, solarMW(22), 600,   0),
    makeHour(23, 24500, 17500, 1450, 1400, solarMW(23), 600,   0)
  ];

  /* =========================================================
   * 2. ANNUAL HISTORY 2014-2024
   *
   * Anchors (from PLN AR):
   *   2014: 149.6 TWh, peak 22.5 GW, renewable 6.4%, coal 62%, 850 gCO2/kWh
   *   2016: 175.1 TWh
   *   2018: 207.0 TWh
   *   2020: 192.7 TWh  (COVID dip)
   *   2022: 226.5 TWh
   *   2024: 249.8 TWh, peak 32.0 GW, renewable 13.5%, coal 62%, 781 gCO2/kWh
   *
   * Intermediate years interpolated monotonically except 2020 dip.
   * by_fuel_twh sums must equal demand_twh ±1%.
   * ========================================================= */

  /**
   * Build an annual history entry, with gas filling the balance.
   * @param {number} year
   * @param {number} demandTwh      total demand in TWh
   * @param {number} peakGw         peak demand in GW
   * @param {number} renewablePct   % renewables
   * @param {number} coalPct        % coal
   * @param {number} gco2           gCO2/kWh
   * @param {number} coalTwh
   * @param {number} hydroTwh
   * @param {number} geoTwh
   * @param {number} biomassTwh
   * @param {number} solarTwh
   * @param {number} dieselTwh
   * @returns {Object}
   */
  function makeYear(year, demandTwh, peakGw, renewablePct, coalPct, gco2,
                    coalTwh, hydroTwh, geoTwh, biomassTwh, solarTwh, dieselTwh) {
    // gas fills the balance
    var gasTwh = parseFloat(
      (demandTwh - coalTwh - hydroTwh - geoTwh - biomassTwh - solarTwh - dieselTwh).toFixed(2)
    );
    return {
      year:          year,
      demand_twh:    demandTwh,
      peak_gw:       peakGw,
      renewable_pct: renewablePct,
      coal_pct:      coalPct,
      gco2_per_kwh:  gco2,
      by_fuel_twh: {
        coal:       coalTwh,
        gas:        gasTwh,
        hydro:      hydroTwh,
        geothermal: geoTwh,
        biomass:    biomassTwh,
        solar:      solarTwh,
        diesel:     dieselTwh
      }
    };
  }

  // Calibrated so sum of by_fuel_twh == demand_twh ±1%
  // Coal ~62% throughout (anchored), gas fills balance, renewables grow
  var annualHistory = [
    //        yr   dmd    pk    re%   co%   gco2   coal   hydro  geo    bio   sol  diesel
    makeYear(2014, 149.6, 22.5,  6.4, 62.0, 850,   92.7,  5.8,  4.0,  2.8, 0.0,  2.3),
    makeYear(2015, 162.0, 23.6,  6.8, 62.0, 840,  100.4,  6.2,  4.4,  3.1, 0.1,  2.5),
    makeYear(2016, 175.1, 24.8,  7.2, 62.0, 832,  108.6,  6.8,  4.8,  3.4, 0.1,  2.7),
    makeYear(2017, 191.0, 26.0,  8.0, 62.0, 820,  118.4,  7.8,  5.4,  4.0, 0.2,  2.9),
    makeYear(2018, 207.0, 27.2,  8.6, 62.0, 810,  128.3,  8.6,  5.9,  4.5, 0.4,  3.1),
    makeYear(2019, 218.5, 28.4,  9.2, 62.0, 800,  135.5,  9.2,  6.3,  5.0, 0.6,  3.3),
    makeYear(2020, 192.7, 26.0,  9.8, 62.0, 798,  119.5,  8.2,  5.8,  4.6, 0.6,  2.9),
    makeYear(2021, 210.0, 27.5, 10.5, 62.0, 792,  130.2,  8.9,  6.2,  5.1, 0.9,  3.1),
    makeYear(2022, 226.5, 29.2, 11.2, 62.0, 787,  140.4,  9.8,  6.7,  5.6, 1.3,  3.3),
    makeYear(2023, 238.5, 30.8, 12.4, 62.0, 783,  147.9, 10.5,  7.1,  6.2, 1.9,  3.5),
    makeYear(2024, 249.8, 32.0, 13.5, 62.0, 781,  154.9, 11.2,  7.5,  6.8, 2.6,  3.7)
  ];

  /* =========================================================
   * 3. MAIN DATA OBJECT
   * ========================================================= */

  var PLN_ENERGY_DATA = {
    version: '2026-05-01-v5',
    units: { power: 'MW', energy: 'GWh', emissions: 'gCO2/kWh' },

    // ---------- National snapshot (evening peak, representative of PLN AR 2024 + RUPTL 2025-2034) ----------
    snapshot: {
      timestamp:        '2026-05-01T18:00:00+07:00',
      demand_mw:         28400,
      generation_mw:     28400,
      reserve_mw:        18600,   // installed 47000 - demand 28400
      frequency_hz:      50.02,
      carbon_intensity:   781,    // gCO2/kWh, Java-Bali coal-heavy
      renewable_pct:      13.5,
      sites_total:         744,
      plants_total:        141,
      turn_up_mw:         1500,
      turn_down_mw:        800
    },

    // ---------- Generation fuel mix (% of generation_mw at snapshot) ----------
    fuels: [
      { id: 'coal',       label: 'Coal',       color: '#64748b', mw: 17608, pct: 62, gwh_today: 422, tonnes_co2: 388000, group: 'fossil',    carbon_intensity: 920 },
      { id: 'gas',        label: 'Gas',        color: '#3b82f6', mw:  6248, pct: 22, gwh_today: 151, tonnes_co2:  75000, group: 'fossil',    carbon_intensity: 490 },
      { id: 'hydro',      label: 'Hydro',      color: '#06b6d4', mw:  1704, pct:  6, gwh_today:  41, tonnes_co2:      0, group: 'renewable', carbon_intensity:   0 },
      { id: 'geothermal', label: 'Geothermal', color: '#f97316', mw:  1136, pct:  4, gwh_today:  27, tonnes_co2:      0, group: 'renewable', carbon_intensity:   0 },
      { id: 'biomass',    label: 'Biomass',    color: '#84cc16', mw:   568, pct:  2, gwh_today:  14, tonnes_co2:      0, group: 'renewable', carbon_intensity:   0 },
      { id: 'solar',      label: 'Solar',      color: '#facc15', mw:   568, pct:  2, gwh_today:  14, tonnes_co2:      0, group: 'renewable', carbon_intensity:   0 },
      { id: 'diesel',     label: 'Diesel',     color: '#9ca3af', mw:   568, pct:  2, gwh_today:  14, tonnes_co2:  17000, group: 'fossil',    carbon_intensity: 700 }
    ],

    // ---------- 24-hour synthetic demand profile ----------
    hourly_24h: hourly24h,

    // ---------- 10-year annual aggregates 2014-2024 ----------
    annual_history: annualHistory,

    // ---------- Province peak demand baseline (PLN AR 2024) ----------
    province_peak_mw: {
      'jakarta-banten': 11500,
      'jabar':           8200,
      'jateng':          5400,
      'jatim':           6900,
      'bali':            1000
    },

    // ---------- Per-province carbon intensity (gCO₂/kWh) ----------
    // Reflects each province's bias in the dispatched mix.
    // - jakarta-banten: Suralaya 4×600 MW coal anchor + Muara Karang/Tanjung Priok gas
    // - jabar: Cirata + Saguling + Jatiluhur hydro + Wayang Windu/Patuha geothermal (cleanest)
    // - jateng: Tanjung Jati B coal-heavy + Mrica hydro + Dieng geothermal
    // - jatim: Paiton 4.71 GW coal anchor + Grati gas
    // - bali: Pemaron gas + 4×150 kV submarine import (no coal on Bali island)
    // Java-Bali system-wide weighted avg ≈ 781 gCO₂/kWh (matches snapshot).
    province_carbon_intensity_gco2kwh: {
      'jakarta-banten': 830,
      'jabar':          580,
      'jateng':         740,
      'jatim':          830,
      'bali':           520
    },

    province_label: {
      'jakarta-banten': 'DKI Jakarta + Banten',
      'jabar':          'Jawa Barat',
      'jateng':         'Jawa Tengah + DIY',
      'jatim':          'Jawa Timur',
      'bali':           'Bali'
    },

    // ---------- Records ----------
    records: {
      highest_demand:    { value_mw:  32400, when: '2024-08-14T19:00:00+07:00', label: 'Highest demand day' },
      highest_renewable: { value_pct:  16.2, when: '2025-Q1',                   label: 'Highest renewable share' },
      lowest_carbon:     { value_gco2:  728, when: '2024-Q1',                   label: 'Lowest CO2 intensity' },
      largest_outage:    { affected_million: 21, when: '2019-08',               label: 'Largest blackout (Java-Madura-Bali, August 2019)' }
    }
  };

  /* =========================================================
   * 4. HELPER: computeProvinceAggregates
   *
   * Iterates plnGrid.nodes, sums mva per province, counts
   * stations and plants, then merges with the static
   * province_peak_mw lookup.
   *
   * @param {Object} plnGrid  window.PLN_JAVA_GRID {nodes, edges, national}
   * @returns {Array<ProvinceAggregate>}  per standarization/PLN_DATA_SCHEMA.md §6
   * ========================================================= */
  PLN_ENERGY_DATA.computeProvinceAggregates = function computeProvinceAggregates(plnGrid) {
    var PROVINCES = ['jakarta-banten', 'jabar', 'jateng', 'jatim', 'bali'];
    var peakTable = PLN_ENERGY_DATA.province_peak_mw;

    // Defensive: return empty array on bad input
    if (!plnGrid || !Array.isArray(plnGrid.nodes)) {
      return [];
    }

    // Initialise accumulators for all provinces
    var acc = {};
    PROVINCES.forEach(function (prov) {
      acc[prov] = { installedMW: 0, stations: 0, plants: 0 };
    });

    // Aggregate nodes
    plnGrid.nodes.forEach(function (node) {
      if (!node || !node.prov) return;
      var prov = node.prov;
      if (!acc[prov]) return;  // unknown province — skip gracefully

      var mva = (typeof node.mva === 'number' && isFinite(node.mva)) ? node.mva : 0;
      acc[prov].installedMW += mva;

      if (node.kind === 'plant') {
        acc[prov].plants += 1;
      } else {
        // treat 'station' and any unknown kind as a station
        acc[prov].stations += 1;
      }
    });

    var co2Table  = PLN_ENERGY_DATA.province_carbon_intensity_gco2kwh || {};

    // Build result array
    return PROVINCES.map(function (prov) {
      var a         = acc[prov];
      var peakMW    = peakTable[prov] || 0;
      var installed = a.installedMW;
      var reserveMW = installed - peakMW;
      var utilPct   = installed > 0
        ? clamp((peakMW / installed) * 100, 0, 200)
        : 0;
      var co2       = co2Table[prov] !== undefined ? co2Table[prov] : 0;

      return {
        prov:            prov,
        installedMW:     Math.round(installed),
        peakMW:          peakMW,
        reserveMW:       Math.round(reserveMW),
        utilizationPct:  parseFloat(utilPct.toFixed(2)),
        carbonIntensity: co2,
        stations:        a.stations,
        plants:          a.plants
      };
    });
  };

  /* =========================================================
   * 5. MULTI-RANGE TIME-SERIES (24h / 2d / 7d / 1M / 3M / 1Y)
   *
   * Synthesizes 6 datasets from the canonical hourly_24h profile.
   * Each dataset has a uniform shape so the page can swap data
   * without branching: { label, ticks, interval, by_fuel,
   * demand, carbon_intensity, x_labels(i) }.
   *
   * Modulation:
   *   - 7d: weekday/weekend (Mon-Fri 1.00, Sat 0.92, Sun 0.88)
   *   - 1Y: seasonal — Indonesian dry season May-Oct +4%, rainy
   *         season Nov-Apr baseline
   *   - 1M / 3M: weekly cyclicity (~+/- 2% per week)
   * Daily/weekly/monthly aggregates take the average per period.
   * ========================================================= */

  var FUELS = ['coal', 'gas', 'hydro', 'geothermal', 'biomass', 'solar', 'diesel'];
  var FUEL_INTENSITY = { coal: 920, gas: 490, hydro: 0, geothermal: 0, biomass: 0, solar: 0, diesel: 700 };
  var DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var DAY_FACTOR = [1.00, 1.00, 1.00, 1.00, 1.00, 0.92, 0.88]; // Mon..Sun
  var MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // Indonesian seasonal modulation (1.00 = baseline, 1.04 = dry season +4%)
  var MONTH_FACTOR = [1.00, 1.00, 1.00, 1.01, 1.04, 1.04, 1.04, 1.04, 1.04, 1.04, 1.01, 1.00];

  // Per-fuel monthly factors (Jan=0 … Dec=11) — drives carbon intensity seasonal wave.
  // Hydro: wet-season reservoir fill peaks Feb-Mar, troughs Aug-Sep (Java major dams).
  // Solar: dry-season clear skies peak Jun-Aug; monsoon cloud cover depresses Jan-Feb.
  // Gas:   swing fuel — compensates hydro drop in dry season.
  // Coal:  baseload, minor seasonal nudge (slightly higher when hydro is low).
  // Geo/Biomass/Diesel: near-constant (baseload / seasonal-independent dispatch).
  var MONTHLY_FUEL_FACTORS = {
    //              Jan   Feb   Mar   Apr   May   Jun   Jul   Aug   Sep   Oct   Nov   Dec
    coal:       [0.97, 0.97, 0.98, 0.99, 1.01, 1.02, 1.04, 1.04, 1.03, 1.01, 0.99, 0.97],
    gas:        [0.93, 0.92, 0.94, 0.97, 1.02, 1.05, 1.07, 1.08, 1.05, 1.00, 0.97, 0.94],
    hydro:      [1.45, 1.55, 1.40, 1.20, 0.90, 0.72, 0.60, 0.58, 0.65, 0.85, 1.15, 1.35],
    geothermal: [1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
    biomass:    [1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
    solar:      [0.72, 0.75, 0.83, 0.91, 1.06, 1.15, 1.22, 1.22, 1.14, 1.02, 0.88, 0.74],
    diesel:     [0.97, 0.97, 0.98, 0.99, 1.01, 1.02, 1.03, 1.03, 1.02, 1.00, 0.99, 0.97]
  };

  function carbonAt(byFuelAtTick) {
    var totalMw = 0, weighted = 0;
    for (var k in byFuelAtTick) {
      if (Object.prototype.hasOwnProperty.call(byFuelAtTick, k)) {
        var v = byFuelAtTick[k];
        totalMw += v;
        weighted += v * (FUEL_INTENSITY[k] || 0);
      }
    }
    return totalMw > 0 ? Math.round(weighted / totalMw) : 0;
  }

  function scaleByFuelAt(hourIdx, factor) {
    var src = hourly24h[hourIdx % 24].by_fuel;
    var out = {};
    FUELS.forEach(function (f) { out[f] = Math.round((src[f] || 0) * factor); });
    return out;
  }

  function avgByFuel(records) {
    var out = {};
    FUELS.forEach(function (f) {
      var s = 0;
      records.forEach(function (r) { s += r.by_fuel[f] || 0; });
      out[f] = Math.round(s / Math.max(1, records.length));
    });
    return out;
  }

  function buildHourlyRange(numHours, factorAtHour) {
    var byFuel = {}; FUELS.forEach(function (f) { byFuel[f] = []; });
    var demand = [], carbon = [];
    for (var h = 0; h < numHours; h++) {
      var f = factorAtHour(h);
      var record = scaleByFuelAt(h, f);
      FUELS.forEach(function (fuel) { byFuel[fuel].push(record[fuel]); });
      var d = 0;
      FUELS.forEach(function (fuel) { d += record[fuel]; });
      demand.push(d);
      carbon.push(carbonAt(record));
    }
    return { by_fuel: byFuel, demand: demand, carbon_intensity: carbon };
  }

  function buildAggregateRange(numTicks, factorAtTick, hoursPerTick) {
    // For each tick, average factor over the tick window applied to a 24h cycle
    var byFuel = {}; FUELS.forEach(function (f) { byFuel[f] = []; });
    var demand = [], carbon = [];
    for (var t = 0; t < numTicks; t++) {
      var factor = factorAtTick(t);
      // Sum over 24 hourly slots scaled by factor — produces a daily-equivalent average
      var fuelSum = {}; FUELS.forEach(function (fuel) { fuelSum[fuel] = 0; });
      for (var h = 0; h < 24; h++) {
        var rec = scaleByFuelAt(h, factor);
        FUELS.forEach(function (fuel) { fuelSum[fuel] += rec[fuel]; });
      }
      // Convert to per-tick average MW (so all tick-types share GW units)
      FUELS.forEach(function (fuel) { byFuel[fuel].push(Math.round(fuelSum[fuel] / 24)); });
      var d = 0;
      FUELS.forEach(function (fuel) { d += byFuel[fuel][t]; });
      demand.push(d);
      var perFuelAtT = {}; FUELS.forEach(function (fuel) { perFuelAtT[fuel] = byFuel[fuel][t]; });
      carbon.push(carbonAt(perFuelAtT));
    }
    return { by_fuel: byFuel, demand: demand, carbon_intensity: carbon };
  }

  // Compute per-fuel 24h daily average MW from the hourly profile.
  var _dailyAvgByFuel = (function () {
    var out = {};
    FUELS.forEach(function (f) { out[f] = 0; });
    hourly24h.forEach(function (h) {
      FUELS.forEach(function (f) { out[f] += (h.by_fuel[f] || 0); });
    });
    FUELS.forEach(function (f) { out[f] = out[f] / 24; });
    return out;
  }());

  // Build 12-month dataset applying independent per-fuel seasonal factors.
  // This produces a realistic CI seasonal wave: wet season (Jan-Mar) lower CI
  // from high hydro; dry season (Jul-Aug) higher CI as coal/gas fill hydro gap.
  function buildMonthlyRange() {
    var byFuel = {}; FUELS.forEach(function (f) { byFuel[f] = []; });
    var demand = [], carbon = [];
    for (var m = 0; m < 12; m++) {
      var perFuel = {};
      FUELS.forEach(function (f) {
        var fac = (MONTHLY_FUEL_FACTORS[f] || [])[m] || 1.0;
        perFuel[f] = Math.round(_dailyAvgByFuel[f] * fac);
      });
      var d = 0;
      FUELS.forEach(function (f) { d += perFuel[f]; });
      demand.push(d);
      carbon.push(carbonAt(perFuel));
      FUELS.forEach(function (f) { byFuel[f].push(perFuel[f]); });
    }
    return { by_fuel: byFuel, demand: demand, carbon_intensity: carbon };
  }

  // Build N-tick dataset for ranges shorter than 1Y (e.g. 3M) using
  // per-fuel factors for a target seasonal period, with small tick-level noise.
  // fuelFactors: object {fuel: baselineFactor}, noiseFn(t): small scalar noise.
  function buildPerFuelRange(numTicks, fuelFactors, noiseFn) {
    var byFuel = {}; FUELS.forEach(function (f) { byFuel[f] = []; });
    var demand = [], carbon = [];
    for (var t = 0; t < numTicks; t++) {
      var noise = noiseFn ? noiseFn(t) : 1.0;
      var perFuel = {};
      FUELS.forEach(function (f) {
        var fac = (fuelFactors[f] || 1.0) * noise;
        perFuel[f] = Math.round(_dailyAvgByFuel[f] * fac);
      });
      var d = 0;
      FUELS.forEach(function (f) { d += perFuel[f]; });
      demand.push(d);
      carbon.push(carbonAt(perFuel));
      FUELS.forEach(function (f) { byFuel[f].push(perFuel[f]); });
    }
    return { by_fuel: byFuel, demand: demand, carbon_intensity: carbon };
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  var range24h = (function () {
    var b = buildHourlyRange(24, function () { return 1.00; });
    return {
      label: '24 hours', ticks: 24, interval: 'hour',
      by_fuel: b.by_fuel, demand: b.demand, carbon_intensity: b.carbon_intensity,
      x_labels: function (i) { return (i % 4 === 0) ? (pad2(i) + ':00') : ''; }
    };
  }());

  var range2d = (function () {
    var b = buildHourlyRange(48, function (h) { return h < 24 ? 0.97 : 1.00; }); // yesterday slightly lower
    return {
      label: '2 days', ticks: 48, interval: 'hour',
      by_fuel: b.by_fuel, demand: b.demand, carbon_intensity: b.carbon_intensity,
      x_labels: function (i) {
        if (i === 0) return 'Yesterday 00:00';
        if (i === 12) return 'Yesterday 12:00';
        if (i === 24) return 'Today 00:00';
        if (i === 36) return 'Today 12:00';
        return '';
      }
    };
  }());

  var range7d = (function () {
    var b = buildHourlyRange(168, function (h) {
      var dayIdx = Math.floor(h / 24) % 7;
      return DAY_FACTOR[dayIdx];
    });
    return {
      label: '7 days', ticks: 168, interval: 'hour',
      by_fuel: b.by_fuel, demand: b.demand, carbon_intensity: b.carbon_intensity,
      x_labels: function (i) {
        var hourOfDay = i % 24;
        var dayIdx = Math.floor(i / 24);
        return (hourOfDay === 12 && dayIdx < 7) ? DAY_NAMES[dayIdx] : '';
      }
    };
  }());

  var range1M = (function () {
    var b = buildAggregateRange(30, function (t) {
      var dayIdx = t % 7;
      return DAY_FACTOR[dayIdx] * (1 + 0.005 * Math.sin(t / 4));
    }, 24);
    return {
      label: '1 month', ticks: 30, interval: 'day',
      by_fuel: b.by_fuel, demand: b.demand, carbon_intensity: b.carbon_intensity,
      x_labels: function (i) { return (i % 5 === 0) ? ('Day ' + (i + 1)) : ''; }
    };
  }());

  var range3M = (function () {
    // Q3 Jul-Sep dry season: average per-fuel factors for months 6/7/8, plus
    // week-level demand noise (+/-1%) to break the flat bands.
    var q3Fuel = {};
    FUELS.forEach(function (f) {
      var mf = MONTHLY_FUEL_FACTORS[f] || [];
      q3Fuel[f] = ((mf[6] || 1) + (mf[7] || 1) + (mf[8] || 1)) / 3;
    });
    var b = buildPerFuelRange(13, q3Fuel, function (t) {
      return 1.0 + 0.012 * Math.sin(t * 0.9 + 0.4);
    });
    return {
      label: '3 months', ticks: 13, interval: 'week',
      by_fuel: b.by_fuel, demand: b.demand, carbon_intensity: b.carbon_intensity,
      x_labels: function (i) { return 'W' + (i + 1); }
    };
  }());

  var range1Y = (function () {
    var b = buildMonthlyRange();
    return {
      label: '1 year', ticks: 12, interval: 'month',
      by_fuel: b.by_fuel, demand: b.demand, carbon_intensity: b.carbon_intensity,
      x_labels: function (i) { return MONTH_NAMES[i]; }
    };
  }());

  PLN_ENERGY_DATA.multi_range = {
    '24h': range24h,
    '2d':  range2d,
    '7d':  range7d,
    '1M':  range1M,
    '3M':  range3M,
    '1Y':  range1Y
  };

  /**
   * Get a range dataset by key.
   * @param {string} rangeKey  '24h' | '2d' | '7d' | '1M' | '3M' | '1Y'
   * @returns {{label,ticks,interval,by_fuel,demand,carbon_intensity,x_labels}}
   */
  PLN_ENERGY_DATA.getRange = function getRange(rangeKey) {
    return PLN_ENERGY_DATA.multi_range[rangeKey] || PLN_ENERGY_DATA.multi_range['24h'];
  };

  /* =========================================================
   * 6. EXPORT
   * ========================================================= */
  win.PLN_ENERGY_DATA = PLN_ENERGY_DATA;

}(typeof window !== 'undefined' ? window : this));
