/*
 * points.js — window.RZDatahallAIPoints: the limits of every DC AI point (PRD-DCAI-NUMBERS §3, phase B1).
 * Owner N1 (2026-11-20): "parameter angka yg normal kasih warna hijau … kuning … merah".
 *
 * A record is one point CLASS (every CDU's TCS supply shares it). Its limits are RELATIVE to the engine setpoint, so a
 * change of design moves them (owner decision 2026-11-20): the engine sets TCS supply 40 °C, so a fixed "35 green /
 * 37 yellow" would paint the healthy plant red. Every banded record names its source and its evidence class:
 *   standard — the limit is a published standard (ASHRAE, ISO, IEC, NEMA, grid code)
 *   design   — the limit is an engine design figure
 *   assumed  — a declared training setting, shown as "limits ASSUMED" in the tooltip (RZPointStatus)
 * A point with no defensible limit is kind 'none': it shows its value without a colour. A band is never invented.
 *
 *   records()                 -> the registry rows (frozen)
 *   setpoint(id, snap)        -> number | null       id = '<class>/<point>'
 *   resolve(id, snap)         -> L = { lo_alarm, lo_warn, hi_warn, hi_alarm, deadband, basis, evidenceClass,
 *                                      source: { ref, asOf } }  — the shape of RZPointStatus.define(id, L); absolute
 *   classify(id, v, snap)     -> 'normal' | 'warning' | 'alarm' | 'none'   (no deadband: the plain band test; the
 *                                page's live colour goes through RZPointStatus.classify, which adds ISA-18.2 deadband)
 *   table(snap)               -> rows for the owner: id, label, unit, setpoint, warn, alarm, evidence, source
 * Pure: no DOM. UMD (Node gate tools/test-dcai-points.mjs).
 *
 * Limit forms: a number is RELATIVE to the setpoint (mode 'rel', in the unit), a percent of it (mode 'pct'), or
 * ABSOLUTE (mode 'abs'); { path } reads an engine snapshot path. high = hi_warn / hi_alarm; low = lo_warn / lo_alarm;
 * window = both, the low side from lowWarn / lowAlarm (same mode, given as the distance below the setpoint for
 * rel / pct).
 */
(function (root) {
  'use strict';
  var AS_OF = '2026-11';
  var ASHRAE_A1 = 'ASHRAE TC9.9 Thermal Guidelines (5th ed.), class A1: recommended 18–27 °C, allowable 15–32 °C';
  var ASM_LIQ = 'declared training setting: +1 K warning, +3 K alarm above the engine setpoint; ceiling ASHRAE TC9.9 liquid-cooling class W45 (facility water ≤ 45 °C)';
  var ASM_HX = 'declared training setting: ±1.5 K / ±3 K around the engine setpoint (plate-HX approach)';
  var ASM_DP = 'declared training setting: ±20 % warning, ±35 % alarm of the design differential pressure';
  function tcs(cls, point, label, plane, hiOnly) {
    return { cls: cls, point: point, label: label, unit: '°C', kind: 'high', sp: { plane: plane }, mode: 'rel', warn: 1, alarm: 3, evidenceClass: 'assumed', source: ASM_LIQ };
  }
  var R = [
    /* ── CDU ─────────────────────────────────────────────────────────────────────────────────────────────── */
    tcs('cdu', 'tcs_supply_c', 'TCS supply', 'p07_tcs_supply_c'),
    tcs('cdu', 'tcs_return_c', 'TCS return', 'p08_tcs_return_c'),
    { cls: 'cdu', point: 'htw_supply_c', label: 'HTW supply', unit: '°C', kind: 'window', sp: { plane: 'p05_htw_supply_c' }, mode: 'rel', warn: 1.5, alarm: 3, lowWarn: 1.5, lowAlarm: 3, evidenceClass: 'assumed', source: ASM_HX },
    { cls: 'cdu', point: 'htw_return_c', label: 'HTW return', unit: '°C', kind: 'high', sp: { plane: 'p06_htw_return_c' }, mode: 'rel', warn: 1.5, alarm: 3, evidenceClass: 'assumed', source: ASM_HX },
    { cls: 'cdu', point: 'pump_amps', label: 'Pump current', unit: 'A', kind: 'high', sp: { value: 42 }, mode: 'pct', warn: 10, alarm: 15, evidenceClass: 'standard', source: 'NEMA MG 1: service factor 1.15 — warning at 110 %, alarm at 115 % of the nameplate current' },
    { cls: 'cdu', point: 'dp_bar', label: 'Differential pressure', unit: 'bar', kind: 'window', sp: { value: 1.8 }, mode: 'pct', warn: 20, alarm: 35, lowWarn: 20, lowAlarm: 35, evidenceClass: 'assumed', source: ASM_DP },
    { cls: 'cdu', point: 'pump_rpm', label: 'Pump speed', unit: 'rpm', kind: 'none', source: 'control output of the VFD: its value follows demand, it has no alarm band' },
    { cls: 'cdu', point: 'valve_pct', label: 'Control valve', unit: '%', kind: 'none', source: 'control output: its position follows the loop, it has no alarm band' },
    /* ── chiller ─────────────────────────────────────────────────────────────────────────────────────────── */
    { cls: 'chiller', point: 'chw_supply_c', label: 'CHW supply', unit: '°C', kind: 'high', sp: { plane: 'p12_chw_supply_c' }, mode: 'rel', warn: 1, alarm: 2, evidenceClass: 'assumed', source: 'declared training setting: +1 K warning, +2 K alarm above the engine CHW supply setpoint' },
    { cls: 'chiller', point: 'chw_return_c', label: 'CHW return', unit: '°C', kind: 'high', sp: { plane: 'p13_chw_return_c' }, mode: 'rel', warn: 1.5, alarm: 3, evidenceClass: 'assumed', source: ASM_HX },
    { cls: 'chiller', point: 'cdw_supply_c', label: 'CDW in', unit: '°C', kind: 'high', sp: { plane: 'p15_cdw_supply_c' }, mode: 'rel', warn: 1.5, alarm: 3, evidenceClass: 'assumed', source: ASM_HX },
    { cls: 'chiller', point: 'cdw_return_c', label: 'CDW out', unit: '°C', kind: 'high', sp: { plane: 'p16_cdw_return_c' }, mode: 'rel', warn: 1.5, alarm: 3, evidenceClass: 'assumed', source: ASM_HX },
    { cls: 'chiller', point: 'vfd_pct', label: 'Compressor VFD', unit: '%', kind: 'none', source: 'control output' },
    { cls: 'chiller', point: 'bearing_c', label: 'Bearing temperature', unit: '°C', kind: 'none', source: 'no published limit for the magnetic-bearing class the page names' },
    /* ── dry cooler ──────────────────────────────────────────────────────────────────────────────────────── */
    { cls: 'dry-cooler', point: 'leaving_c', label: 'Fluid leaving', unit: '°C', kind: 'high', sp: { plane: 'p02_dry_cooler_leaving_c' }, mode: 'rel', warn: 1.5, alarm: 3, evidenceClass: 'assumed', source: ASM_HX },
    { cls: 'dry-cooler', point: 'motor_c', label: 'Fan motor temperature', unit: '°C', kind: 'high', sp: { value: 62 }, mode: 'abs', warn: 130, alarm: 155, evidenceClass: 'assumed', source: 'IEC 60034-1 thermal class F: 155 °C alarm; 130 °C warning is a declared setting' },
    { cls: 'dry-cooler', point: 'ambient_c', label: 'Ambient DB', unit: '°C', kind: 'none', source: 'weather: an input, not a controlled value' },
    { cls: 'dry-cooler', point: 'fan_pct', label: 'Fan speed', unit: '%', kind: 'none', source: 'control output' },
    /* ── pump stations ───────────────────────────────────────────────────────────────────────────────────── */
    { cls: 'cw-pump-station', point: 'cdw_supply_c', label: 'CDW supply', unit: '°C', kind: 'high', sp: { plane: 'p15_cdw_supply_c' }, mode: 'rel', warn: 1.5, alarm: 3, evidenceClass: 'assumed', source: ASM_HX },
    { cls: 'cw-pump-station', point: 'cdw_return_c', label: 'CDW return', unit: '°C', kind: 'high', sp: { plane: 'p16_cdw_return_c' }, mode: 'rel', warn: 1.5, alarm: 3, evidenceClass: 'assumed', source: ASM_HX },
    { cls: 'cw-pump-station', point: 'head_bar', label: 'Discharge head', unit: 'bar', kind: 'window', sp: { value: 4.5 }, mode: 'pct', warn: 15, alarm: 30, lowWarn: 15, lowAlarm: 30, evidenceClass: 'assumed', source: 'declared training setting: ±15 % warning, ±30 % alarm of the design head' },
    { cls: 'cw-pump-station', point: 'vib_mms', label: 'Vibration', unit: 'mm/s', kind: 'high', sp: { value: 2.1 }, mode: 'abs', warn: 2.8, alarm: 4.5, evidenceClass: 'standard', source: 'ISO 10816-3, group 2 rigid mounting: zone B/C 2.8 mm/s (warning), C/D 4.5 mm/s (alarm)' },
    { cls: 'fws-pump-station', point: 'htw_supply_c', label: 'HTW supply', unit: '°C', kind: 'window', sp: { plane: 'p05_htw_supply_c' }, mode: 'rel', warn: 1.5, alarm: 3, lowWarn: 1.5, lowAlarm: 3, evidenceClass: 'assumed', source: ASM_HX },
    { cls: 'fws-pump-station', point: 'htw_return_c', label: 'HTW return', unit: '°C', kind: 'high', sp: { plane: 'p06_htw_return_c' }, mode: 'rel', warn: 1.5, alarm: 3, evidenceClass: 'assumed', source: ASM_HX },
    { cls: 'fws-pump-station', point: 'head_bar', label: 'Discharge head', unit: 'bar', kind: 'window', sp: { value: 3.8 }, mode: 'pct', warn: 15, alarm: 30, lowWarn: 15, lowAlarm: 30, evidenceClass: 'assumed', source: 'declared training setting: ±15 % warning, ±30 % alarm of the design head' },
    { cls: 'fws-pump-station', point: 'vfd_hz', label: 'VFD frequency', unit: 'Hz', kind: 'none', source: 'control output (capped at 50 Hz)' },
    { cls: 'fws-piping', point: 'pressure_bar', label: 'Header pressure', unit: 'bar', kind: 'window', sp: { value: 2.1 }, mode: 'pct', warn: 15, alarm: 30, lowWarn: 15, lowAlarm: 30, evidenceClass: 'assumed', source: 'declared training setting: ±15 % warning, ±30 % alarm of the header design pressure' },
    /* ── TCS distribution and racks ──────────────────────────────────────────────────────────────────────── */
    tcs('tcs-manifold', 'tcs_supply_c', 'TCS supply', 'p07_tcs_supply_c'),
    tcs('tcs-manifold', 'tcs_return_c', 'TCS return', 'p08_tcs_return_c'),
    { cls: 'tcs-manifold', point: 'manifold_dp', label: 'Manifold ΔP', unit: 'bar', kind: 'window', sp: { value: 0.9 }, mode: 'pct', warn: 20, alarm: 35, lowWarn: 20, lowAlarm: 35, evidenceClass: 'assumed', source: ASM_DP },
    { cls: 'tcs-manifold', point: 'tcs_flow_rack', label: 'Per rack flow', unit: 'L/min', kind: 'low', sp: { path: 'design.flows.tcs_rack_lpm' }, mode: 'pct', lowWarn: 10, lowAlarm: 20, evidenceClass: 'assumed', source: 'declared training setting: warning below 90 %, alarm below 80 % of the engine design flow per rack' },
    tcs('rack-ct', 'inlet_c', 'Cold-plate inlet', 'p07_tcs_supply_c'),
    { cls: 'rack-ct', point: 'gpu_c', label: 'GPU junction', unit: '°C', kind: 'none', source: 'no published GB300 junction limit: shown without a band' },
    { cls: 'rack-unit', point: 'inlet_air_c', label: 'Cold-aisle inlet', unit: '°C', kind: 'window', sp: { plane: 'p10_rack_inlet_c' }, mode: 'abs', warn: 27, alarm: 32, lowWarn: 18, lowAlarm: 15, evidenceClass: 'standard', source: ASHRAE_A1 },
    tcs('rack-unit', 'tcs_in_c', 'TCS inlet', 'p07_tcs_supply_c'),
    tcs('rack-unit', 'tcs_out_c', 'TCS outlet', 'p08_tcs_return_c'),
    { cls: 'rack-unit', point: 'gpu_util', label: 'GPU utilisation', unit: '%', kind: 'none', source: 'workload, not a plant condition' },
    tcs('rack-manifold', 'tcs_supply_c', 'TCS supply', 'p07_tcs_supply_c'),
    tcs('rack-manifold', 'tcs_return_c', 'TCS return', 'p08_tcs_return_c'),
    { cls: 'rack-manifold', point: 'dp_bar', label: 'Manifold ΔP', unit: 'bar', kind: 'window', sp: { value: 0.6 }, mode: 'pct', warn: 20, alarm: 35, lowWarn: 20, lowAlarm: 35, evidenceClass: 'assumed', source: ASM_DP },
    { cls: 'rack-busbar', point: 'vdc', label: 'Bus voltage', unit: 'V', kind: 'window', sp: { value: 48 }, mode: 'pct', warn: 5, alarm: 10, lowWarn: 5, lowAlarm: 10, evidenceClass: 'assumed', source: 'declared training setting: ±5 % warning, ±10 % alarm of the 48 VDC shelf output' },
    { cls: 'rack-backplane', point: 'ber', label: 'Lane errors (post-FEC)', unit: '/h', kind: 'high', sp: { value: 0 }, mode: 'abs', warn: 1, alarm: 10, evidenceClass: 'assumed', source: 'declared training setting: any post-FEC error per hour is a warning, 10 an alarm' },
    /* ── air path ────────────────────────────────────────────────────────────────────────────────────────── */
    { cls: 'crah', point: 'chw_supply_c', label: 'CHW in', unit: '°C', kind: 'high', sp: { plane: 'p12_chw_supply_c' }, mode: 'rel', warn: 1, alarm: 2, evidenceClass: 'assumed', source: 'declared training setting: +1 K warning, +2 K alarm above the engine CHW supply setpoint' },
    { cls: 'crah', point: 'air_supply_c', label: 'Supply air', unit: '°C', kind: 'window', sp: { plane: 'p09_air_supply_c' }, mode: 'abs', warn: 27, alarm: 32, lowWarn: 18, lowAlarm: 15, evidenceClass: 'standard', source: ASHRAE_A1 },
    { cls: 'crah', point: 'air_return_c', label: 'Return air', unit: '°C', kind: 'high', sp: { plane: 'p11_air_return_c' }, mode: 'rel', warn: 4, alarm: 9, evidenceClass: 'assumed', source: 'declared training setting: hot-aisle containment, +4 K warning, +9 K alarm above the engine return-air plane' },
    { cls: 'crah', point: 'supply_rh', label: 'Supply RH', unit: '%', kind: 'window', sp: { value: 45 }, mode: 'abs', warn: 70, alarm: 80, lowWarn: 20, lowAlarm: 8, evidenceClass: 'assumed', source: 'ASHRAE TC9.9 class A1: ≤ 70 % RH recommended, 8–80 % RH allowable (alarm); 20 % RH low warning is a declared setting' },
    { cls: 'crah', point: 'fan_pct', label: 'Fan speed', unit: '%', kind: 'none', source: 'control output' },
    { cls: 'cable-tray', point: 'tray_c', label: 'Tray temperature', unit: '°C', kind: 'high', sp: { value: 32 }, mode: 'abs', warn: 40, alarm: 50, evidenceClass: 'assumed', source: 'declared training setting: cable ratings in IEC 60364-5-52 assume 30 °C air; 40 °C warning, 50 °C alarm' },
    /* ── water treatment ─────────────────────────────────────────────────────────────────────────────────── */
    { cls: 'chem', point: 'ph', label: 'pH', unit: 'pH', kind: 'window', sp: { value: 8.5 }, mode: 'abs', warn: 8.8, alarm: 9.0, lowWarn: 8.2, lowAlarm: 8.0, evidenceClass: 'design', source: 'the page\'s own control window 8.2–8.8 (warning); 8.0 / 9.0 alarm is a declared setting' },
    { cls: 'chem', point: 'conductivity', label: 'Conductivity', unit: 'µS/cm', kind: 'high', sp: { value: 800 }, mode: 'pct', warn: 25, alarm: 50, evidenceClass: 'assumed', source: 'declared training setting: +25 % warning, +50 % alarm over the control setpoint' },
    { cls: 'chem', point: 'orp', label: 'ORP', unit: 'mV', kind: 'window', sp: { value: 450 }, mode: 'abs', warn: 550, alarm: 650, lowWarn: 400, lowAlarm: 350, evidenceClass: 'assumed', source: 'declared training setting around the 450 mV biocide control point' },
    { cls: 'chem', point: 'inhibitor_ppm', label: 'Inhibitor', unit: 'ppm', kind: 'low', sp: { value: 120 }, mode: 'pct', lowWarn: 15, lowAlarm: 30, evidenceClass: 'assumed', source: 'declared training setting: warning below 85 %, alarm below 70 % of the residual target' },
    /* ── electrical ──────────────────────────────────────────────────────────────────────────────────────── */
    { cls: 'sld-mv-sub', point: 'bus_kv', label: 'Bus voltage', unit: 'kV', kind: 'window', sp: { value: 20 }, mode: 'pct', warn: 5, alarm: 10, lowWarn: 5, lowAlarm: 10, evidenceClass: 'standard', source: 'IEC 60038 / SPLN 1: ±5 % operating band (warning), ±10 % (alarm)' },
    { cls: 'sld-mv-sub', point: 'frequency', label: 'Frequency', unit: 'Hz', kind: 'window', sp: { value: 50 }, mode: 'abs', warn: 50.2, alarm: 50.5, lowWarn: 49.8, lowAlarm: 49.5, evidenceClass: 'assumed', source: 'Grid Code Jawa-Madura-Bali: 49.5–50.5 Hz normal operation (alarm); ±0.2 Hz warning is a declared setting' },
    { cls: 'sld-rmu', point: 'bus_kv', label: 'Bus voltage', unit: 'kV', kind: 'window', sp: { value: 20 }, mode: 'pct', warn: 5, alarm: 10, lowWarn: 5, lowAlarm: 10, evidenceClass: 'standard', source: 'IEC 60038 / SPLN 1: ±5 % operating band (warning), ±10 % (alarm)' },
    { cls: 'sld-main-tx', point: 'winding_c', label: 'Top-oil temperature', unit: '°C', kind: 'high', sp: { value: 78 }, mode: 'abs', warn: 90, alarm: 100, evidenceClass: 'assumed', source: 'IEC 60076-2: 60 K top-oil rise over 40 °C ambient = 100 °C (alarm); 90 °C warning is a declared setting' },
    { cls: 'sld-tx', point: 'winding_c', label: 'Winding temperature', unit: '°C', kind: 'high', sp: { value: 95 }, mode: 'abs', warn: 130, alarm: 155, evidenceClass: 'assumed', source: 'IEC 60076-11 insulation class F: 155 °C (alarm); 130 °C warning is a declared setting' },
    { cls: 'sld-msb', point: 'dc_bus_v', label: 'DC bus', unit: 'V', kind: 'window', sp: { value: 480 }, mode: 'pct', warn: 5, alarm: 10, lowWarn: 5, lowAlarm: 10, evidenceClass: 'assumed', source: 'declared training setting: ±5 % / ±10 % of the 480 VDC battery bus' },
    { cls: 'sld-ups-b', point: 'soc_pct', label: 'State of charge', unit: '%', kind: 'low', sp: { value: 98 }, mode: 'abs', lowWarn: 90, lowAlarm: 80, evidenceClass: 'assumed', source: 'declared training setting: warning below 90 %, alarm below 80 % state of charge' },
    { cls: 'site-fuel-farm', point: 'level_pct', label: 'Tank level', unit: '%', kind: 'low', sp: { value: 95 }, mode: 'abs', lowWarn: 85, lowAlarm: 70, evidenceClass: 'assumed', source: 'declared training setting: warning below 85 %, alarm below 70 % of the tank' },
    /* ── page KPIs (not a payload row: page:true) ───────────────────────────────────────────────────────── */
    { cls: 'hall-kpi', point: 'pue', label: 'PUE', unit: '', page: true, kind: 'high', sp: { path: 'pue.design_day' }, mode: 'abs', warn: { path: 'pue.band_max' }, alarm: 1.35, evidenceClass: 'design', source: 'engine design band pue.band_max (warning); 1.35 alarm is a declared setting' },
    /* ── PRD-SETPOINT-SIM §C P5: setpoints that were typed in js/datahall-ai/hmi-payloads.js; no alarm band is stated
       for them, so kind 'none' (no colour), the SP alone, ASSUMED with its basis ── */
    { cls: 'stp', point: 'do_mgl', label: 'Aeration DO', unit: 'mg/L', kind: 'none', sp: { value: 2.5 }, evidenceClass: 'assumed', source: 'declared training setting: activated-sludge aeration is commonly held near 2 mg/L dissolved oxygen (Metcalf & Eddy practice); 2.5 mg/L is this page\'s design value' },
    { cls: 'ahu', point: 'supply_c', label: 'MMR supply air', unit: '°C', kind: 'none', sp: { value: 18 }, evidenceClass: 'assumed', source: 'declared training setting: 18 °C is the low end of the ASHRAE TC9.9 A1 recommended inlet (18–27 °C) for the meet-me room' },
    { cls: 'room', point: 'temp_c', label: 'Support-room temperature', unit: '°C', kind: 'none', sp: { value: 24 }, evidenceClass: 'assumed', source: 'declared training setting: an occupied support room held at 24 °C (ASHRAE 55 comfort range); no source in this repository states the value' },
    { cls: 'room', point: 'rh_pct', label: 'Support-room relative humidity', unit: '%', kind: 'none', sp: { value: 50 }, evidenceClass: 'assumed', source: 'declared training setting: 50 % RH, the middle of the ASHRAE 55 / 62.1 range for occupied rooms; no source in this repository states the value' },
  ];
  R.forEach(function (r) { Object.freeze(r); });
  var BY = {};
  R.forEach(function (r) { BY[r.cls + '/' + r.point] = r; });

  function isNum(n) { return typeof n === 'number' && isFinite(n); }
  function path(snap, p) { var o = snap; String(p).split('.').forEach(function (k) { o = o == null ? null : o[k]; }); return isNum(o) ? o : null; }
  function setpoint(id, snap) {
    var r = BY[id]; if (!r || !r.sp) return null;
    if (r.sp.plane) return path(snap, 'design.planes.' + r.sp.plane);
    if (r.sp.path) return path(snap, r.sp.path);
    return isNum(r.sp.value) ? r.sp.value : null;
  }
  /* one limit value: { path } absolute, else by mode; side -1 = below the setpoint */
  function lim(r, x, sp, snap, side) {
    if (x == null) return null;
    if (typeof x === 'object') return path(snap, x.path);
    if (r.mode === 'abs') return x;
    if (r.mode === 'pct') return sp + side * Math.abs(sp) * x / 100;
    return sp + side * x;
  }
  function round(v) { return v == null ? null : Math.round(v * 1e6) / 1e6; }
  function resolve(id, snap) {
    var r = BY[id]; if (!r || r.kind === 'none') return null;
    var sp = setpoint(id, snap); if (sp == null) throw new Error(id + ': setpoint not found in the engine snapshot');
    var hi = r.kind === 'high' || r.kind === 'window', lo = r.kind === 'low' || r.kind === 'window';
    var L = { lo_alarm: lo ? round(lim(r, r.lowAlarm, sp, snap, -1)) : null, lo_warn: lo ? round(lim(r, r.lowWarn, sp, snap, -1)) : null,
      hi_warn: hi ? round(lim(r, r.warn, sp, snap, 1)) : null, hi_alarm: hi ? round(lim(r, r.alarm, sp, snap, 1)) : null,
      deadband: null, basis: 'setpoint ' + round(sp) + (r.unit ? ' ' + r.unit : ''), evidenceClass: r.evidenceClass, source: { ref: r.source, asOf: AS_OF } };
    var lows = [L.lo_alarm, L.lo_warn].filter(isNum), highs = [L.hi_warn, L.hi_alarm].filter(isNum);
    if ((isNum(L.lo_alarm) && isNum(L.lo_warn) && L.lo_alarm > L.lo_warn) || (isNum(L.hi_warn) && isNum(L.hi_alarm) && L.hi_warn > L.hi_alarm) ||
        (lows.length && highs.length && Math.max.apply(null, lows) >= Math.min.apply(null, highs))) throw new Error(id + ': limits out of order');
    return L;
  }
  function classify(id, v, snap) {
    var L; try { L = resolve(id, snap); } catch (e) { return 'none'; }
    if (!L || !isNum(v)) return 'none';
    if ((isNum(L.hi_alarm) && v > L.hi_alarm) || (isNum(L.lo_alarm) && v < L.lo_alarm)) return 'alarm';
    if ((isNum(L.hi_warn) && v > L.hi_warn) || (isNum(L.lo_warn) && v < L.lo_warn)) return 'warning';
    return 'normal';
  }
  function fmt(a, b) { return [a, b].filter(isNum).length ? (isNum(a) ? '< ' + a : '') + (isNum(a) && isNum(b) ? ' or ' : '') + (isNum(b) ? '> ' + b : '') : '—'; }
  function table(snap) {
    return R.map(function (r) {
      var id = r.cls + '/' + r.point, L = null; try { L = resolve(id, snap); } catch (e) { L = null; }
      return { id: id, label: r.label, unit: r.unit, setpoint: round(setpoint(id, snap)), kind: r.kind,
        warn: L ? fmt(L.lo_warn, L.hi_warn) : '—', alarm: L ? fmt(L.lo_alarm, L.hi_alarm) : '—', evidence: r.kind === 'none' ? 'no band' : r.evidenceClass, source: r.source };
    });
  }
  var API = { records: function () { return R.slice(); }, setpoint: setpoint, resolve: resolve, classify: classify, table: table, version: '1.0.0' };
  if (root) root.RZDatahallAIPoints = Object.freeze(API);
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : null);
