/* rz-hub-product.js — the DC Solutions hub as a product page (PLAN H1, take 4, 2026-10-16).
 *
 * The hero is the plant itself, drawn by the site's own engines and running: RZDiagram lays
 * out one figure (power chain, 150 kV to the rack, then the heat path, rack to ambient) with
 * IEC 60617 / ISA-5.1 glyphs from rz-eng-symbols.js; DCAI_CALC.snapshot supplies every number;
 * the seven weather bins of the design year play through the figure, one at a time, with the
 * readouts tweening and the chillers changing state when the liquid path loses free cooling.
 * Hover or focus reads a box, click pins it, double-click or Enter opens where it is computed.
 * A number the engine does not publish prints "—". Nothing follows the cursor. ES5, no deps
 * beyond the engines.
 */
(function () {
  'use strict';
  if (window.__rzHubProduct) return; window.__rzHubProduct = true;

  var S = window.DCAI_CALC && window.DCAI_CALC.snapshot;
  var D = window.RZDiagram, L = window.RZDiagramLayout;
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NARROW = window.matchMedia ? window.matchMedia('(max-width: 800px)') : { matches: false };
  var DESIGN_BIN = 5, DWELL = 2600, IDLE = 7000;

  function get(path) {
    if (!S) return null;
    var o = S, p = path.split('.');
    for (var i = 0; i < p.length; i++) { if (o == null) return null; o = o[p[i]]; }
    return (typeof o === 'number' && isFinite(o)) || typeof o === 'string' || typeof o === 'boolean' ? o : null;
  }
  function fmt(v, d) {
    if (typeof v === 'boolean') return v ? 'yes' : 'no';
    if (typeof v === 'string') return v;
    return (typeof v === 'number' && isFinite(v)) ? v.toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d == null ? 0 : d }) : '—';
  }
  function F(path, d) { return fmt(get(path), d); }
  function halls() { var M = window.DCAI_MODEL; return fmt(M && M.facility && M.facility.halls); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* A numeral moves to its new value instead of jumping — 620 ms, ease-out, cubic. */
  function tween(el, to, render) {
    if (!el) return;
    var first = typeof el.__v !== 'number', from = first ? 0 : el.__v; el.__v = to;
    /* The first paint is the engine's value, never a count-up from zero: a numeral on this page is
     * either a published value or on its way between two of them. */
    if (first || REDUCE || typeof to !== 'number' || from === to || !window.requestAnimationFrame) { el.textContent = render(to); return; }
    var t0 = performance.now(), dur = 620;
    if (el.__raf) cancelAnimationFrame(el.__raf);
    (function step(now) {
      var p = Math.min(1, (now - t0) / dur); p = 1 - Math.pow(1 - p, 3);
      el.textContent = render(from + (to - from) * p);
      if (p < 1) el.__raf = requestAnimationFrame(step);
    })(t0);
  }

  /* ------------------------------------------------------------------ */
  /* The readout rows behind every node: label · value · registry id      */
  /* ------------------------------------------------------------------ */
  var BIN = DESIGN_BIN;
  function bins() { return (S && S.bins) || []; }
  function bin() { return bins()[BIN] || null; }
  function binRows() {
    var b = bin(); if (!b) return [];
    return [['At ' + b.ambient_db_c + ' °C — PUE', fmt(b.pue, 3), '', 'bins[' + BIN + '].pue'],
            ['Chillers running', fmt(b.chillers_running), '', 'bins[' + BIN + '].chillers_running'],
            ['Liquid path free cooling', fmt(b.liquid_free_cooling), '', 'bins[' + BIN + '].liquid_free_cooling'],
            ['Facility draw', fmt(b.facility_kwe / 1000, 1), 'MW', 'bins[' + BIN + '].facility_kwe']];
  }
  var ROWS = {
    utility: { title: 'Utility intake', sub: '150 kV, two independent substations', href: 'datahallAI.html', rows: [
      ['Intake voltage', F('distribution.hv_intake_kv'), 'kV', 'distribution.hv_intake_kv'],
      ['Circuits, duty + 1', F('distribution.hv_circuits_duty') + ' + 1 of ' + F('distribution.hv_circuits_installed'), '', 'distribution.hv_circuits_installed'],
      ['Thermal rating per circuit', F('distribution.hv_circuit_mva'), 'MVA', 'distribution.hv_circuit_mva'],
      ['Current at the worst bin', F('distribution.hv_current_a'), 'A', 'distribution.hv_current_a']] },
    gis: { title: '150 kV GIS', sub: 'gas-insulated switchyard', href: 'datahallAI.html', rows: [
      ['Line bays', F('distribution.hv_line_bays'), '', 'distribution.hv_line_bays'],
      ['Transformer bays', F('distribution.hv_transformer_bays'), '', 'distribution.hv_transformer_bays'],
      ['Switchyard bays', F('distribution.hv_switchyard_bays'), '', 'distribution.hv_switchyard_bays'],
      ['GIS hall', F('site.gis_hall_m2'), 'm²', 'site.gis_hall_m2']] },
    mtx: { title: 'Main transformers', sub: '150/20 kV, one per hall per feed', href: 'capex-calculator.html', rows: [
      ['Unit rating', F('distribution.main_tx_mva'), 'MVA', 'distribution.main_tx_mva'],
      ['Units', F('distribution.main_tx_total'), '', 'distribution.main_tx_total'],
      ['Loading, normal', F('distribution.main_tx_loading_normal_pct', 1), '%', 'distribution.main_tx_loading_normal_pct'],
      ['Secondary current', F('distribution.main_tx_secondary_a'), 'A', 'distribution.main_tx_secondary_a'],
      ['Impedance', F('distribution.main_tx_impedance_pct'), '%', 'distribution.main_tx_impedance_pct']] },
    mv: { title: '20 kV board', sub: 'bus-tie normally open, sections never parallel', href: 'datahallAI.html', rows: [
      ['Board rating', F('distribution.mv_board_rated_a'), 'A', 'distribution.mv_board_rated_a'],
      ['Fault level per section', F('distribution.mv_fault_ka_per_section', 1), 'kA', 'distribution.mv_fault_ka_per_section'],
      ['Gear rating', F('distribution.mv_board_ka_rating', 1), 'kA', 'distribution.mv_board_ka_rating'],
      ['Within gear', F('distribution.mv_fault_within_gear'), '', 'distribution.mv_fault_within_gear'],
      ['Feeders per hall per feed', F('distribution.mv_feeders_per_hall_per_feed'), '', 'distribution.mv_feeders_per_hall_per_feed']] },
    genset: { title: 'Standby generation', sub: 'facility-shared pool', href: 'capex-calculator.html', rows: [
      ['Installed', F('equipment.gensets_installed'), '', 'equipment.gensets_installed'],
      ['Duty', F('equipment.gensets_duty'), '', 'equipment.gensets_duty'],
      ['Unit rating', F('equipment.generator_unit_kw'), 'kW', 'equipment.generator_unit_kw'],
      ['Model', F('equipment.generator_model'), '', 'equipment.generator_model'],
      ['Fuel autonomy', F('site.fuel_autonomy_h'), 'h', 'site.fuel_autonomy_h']] },
    usub: { title: 'Unit substations', sub: '20/0.4 kV cast-resin, 2N per hall', href: 'capex-calculator.html', rows: [
      ['Unit rating', F('equipment.transformer_unit_mva', 1), 'MVA', 'equipment.transformer_unit_mva'],
      ['Units, facility', F('equipment.transformers'), '', 'equipment.transformers'],
      ['Per feed per hall', F('equipment.unit_subs_per_feed_per_hall'), '', 'equipment.unit_subs_per_feed_per_hall'],
      ['Loading, normal', F('equipment.unit_sub_loading_normal_pct', 1), '%', 'equipment.unit_sub_loading_normal_pct'],
      ['One feed carries the hall', F('equipment.unit_sub_feed_carries_whole_hall'), '', 'equipment.unit_sub_feed_carries_whole_hall']] },
    ups: { title: 'UPS', sub: F('equipment.ups_topology'), href: 'capex-calculator.html', rows: [
      ['Frame rating', F('equipment.ups_frame_kw'), 'kW', 'equipment.ups_frame_kw'],
      ['Frames, facility', F('equipment.ups_frames_total'), '', 'equipment.ups_frames_total'],
      ['Loading, normal', F('equipment.ups_loading_normal_pct', 1), '%', 'equipment.ups_loading_normal_pct'],
      ['Battery, facility', F('equipment.battery_kwh'), 'kWh', 'equipment.battery_kwh']] },
    racks: { title: 'GB300 NVL72 racks', sub: 'one rack is one NVLink domain', href: 'datahallAI.html', rows: [
      ['Racks, facility', F('compute.racks_facility'), '', 'compute.racks_facility'],
      ['Rack IT', F('power.rack_it_kw'), 'kW', 'power.rack_it_kw'],
      ['GPUs', F('compute.gpu_facility'), '', 'compute.gpu_facility'],
      ['Total IT', F('power.total_it_mw', 2), 'MW', 'power.total_it_mw'],
      ['Feed current per rack', F('distribution.rack_feed_current_a'), 'A', 'distribution.rack_feed_current_a']] },
    cdu: { title: 'Coolant distribution units', sub: F('equipment.cdu_model'), href: 'pue-calculator.html', rows: [
      ['Installed, facility', F('equipment.cdu_installed_facility'), '', 'equipment.cdu_installed_facility'],
      ['Duty per hall', F('equipment.cdu_duty_per_hall'), '', 'equipment.cdu_duty_per_hall'],
      ['Unit duty', F('equipment.cdu_unit_kwth'), 'kW th', 'equipment.cdu_unit_kwth'],
      ['TCS supply / return', F('design.planes.p07_tcs_supply_c') + ' / ' + F('design.planes.p08_tcs_return_c'), '°C', 'design.planes.p07_tcs_supply_c'],
      ['Liquid share of heat', fmt(get('heat.liquid_capture_ratio') * 100), '%', 'heat.liquid_capture_ratio']] },
    dry: { title: 'Dry coolers', sub: 'warm-water rejection, no water consumed', href: 'pue-calculator.html', rows: [
      ['Installed', F('equipment.dry_coolers_installed'), '', 'equipment.dry_coolers_installed'],
      ['Running, design day', F('equipment.dry_coolers_running_design'), '', 'equipment.dry_coolers_running_design'],
      ['Unit duty', F('equipment.dry_cooler_unit_kwth'), 'kW th', 'equipment.dry_cooler_unit_kwth'],
      ['Leaving water, design day', F('design.planes.p02_dry_cooler_leaving_c'), '°C', 'design.planes.p02_dry_cooler_leaving_c'],
      ['Free-cooling margin', F('design.planes.p04_free_cooling_margin_k', 1), 'K', 'design.planes.p04_free_cooling_margin_k']] },
    crah: { title: 'Fan walls', sub: 'the air path — the heat the liquid does not take', href: 'pue-calculator.html', rows: [
      ['Modules, facility', F('equipment.crah_installed_facility'), '', 'equipment.crah_installed_facility'],
      ['Unit duty', F('equipment.crah_unit_kwth'), 'kW th', 'equipment.crah_unit_kwth'],
      ['Supply / return air', F('design.planes.p09_air_supply_c') + ' / ' + F('design.planes.p11_air_return_c'), '°C', 'design.planes.p09_air_supply_c'],
      ['Air share of heat', fmt((1 - (get('heat.liquid_capture_ratio') || 0)) * 100), '%', 'heat.liquid_capture_ratio']] },
    chiller: { title: 'Chillers', sub: 'air path only while the liquid path runs free', href: 'pue-calculator.html', rows: [
      ['Installed', F('equipment.chillers_installed'), '', 'equipment.chillers_installed'],
      ['Running, design day', F('equipment.chillers_running_design'), '', 'equipment.chillers_running_design'],
      ['Running, worst bin', F('equipment.chillers_running_worst_bin'), '', 'equipment.chillers_running_worst_bin'],
      ['Unit duty', F('equipment.chiller_unit_kwth'), 'kW th', 'equipment.chiller_unit_kwth'],
      ['COP, air path', F('design.planes.p18_cop_air_path', 2), '', 'design.planes.p18_cop_air_path']] },
    fuel: { title: 'Fuel farm', sub: 'diesel for the standby pool', href: 'fuel-system.html', rows: [
      ['Autonomy', F('site.fuel_autonomy_h'), 'h', 'site.fuel_autonomy_h'],
      ['Stored', F('site.fuel_m3'), 'm³', 'site.fuel_m3'],
      ['Farm area', F('site.fuel_farm_m2'), 'm²', 'site.fuel_farm_m2']] },
    txyard: { title: 'Main transformer yard', sub: '150/20 kV units in the open', href: 'datahallAI.html', rows: [
      ['Units', F('distribution.main_tx_total'), '', 'distribution.main_tx_total'],
      ['Yard area', F('site.main_tx_yard_m2'), 'm²', 'site.main_tx_yard_m2'],
      ['Transformer bays', F('distribution.hv_transformer_bays'), '', 'distribution.hv_transformer_bays']] },
    campus: { title: 'Campus', sub: 'engine layout — a site area that is a product of lengths', href: 'datahallAI.html', rows: [
      ['Site', F('site.site_width_m') + ' × ' + F('site.site_depth_m'), 'm', 'site.site_width_m'],
      ['Site area', F('site.site_area_m2'), 'm²', 'site.site_area_m2'],
      ['Building plate', F('site.plate_length_m') + ' × ' + F('site.plate_width_m'), 'm', 'site.plate_length_m'],
      ['Roads', F('site.roads_m2'), 'm²', 'site.roads_m2'],
      ['Genset yard', F('site.genset_yard_m2'), 'm²', 'site.genset_yard_m2'],
      ['Chiller plant', F('site.chiller_plant_m2'), 'm²', 'site.chiller_plant_m2']] }
  };

  /* ------------------------------------------------------------------ */
  /* FIG. 1 — the plant through RZDiagram                                 */
  /* ------------------------------------------------------------------ */
  function mid(box, side) { return L.fanPoints(box, 1, side)[0]; }
  function node(ctx, x, y, o) { o.interactive = true; if (!o.tier) o.tier = 2; var b = ctx.node(x, y, o); b.id = o.id; return b; }
  function edge(ctx, a, b, o) {
    o = o || {}; o.fromId = a.id; o.toId = b.id;
    var from = o.from || mid(a, o.fromSide || 'right'), to = o.to || mid(b, o.toSide || 'left');
    ctx.layer('e:' + a.id + '>' + b.id);
    ctx.edge({ x: from.x, y: from.y }, { x: to.x, y: to.y }, o);
    ctx.layer(null);
  }
  function powerChain(ctx, x, Y, GAP, H) {
    function step(o) { var b = node(ctx, x, Y, Object.assign({ h: H }, o)); x = b.x + b.w + GAP; return b; }
    var n = {};
    n.utility = step({ id: 'utility', tag: 'grid', name: 'PLN ' + F('distribution.hv_intake_kv') + ' kV', symbol: 'utility', sublabel: F('distribution.hv_circuits_installed') + ' circuits × ' + F('distribution.hv_circuit_mva') + ' MVA' });
    n.gis = step({ id: 'gis', tag: 'hv', name: 'GIS', symbol: 'switchgear', sublabel: F('distribution.hv_switchyard_bays') + ' bays' });
    n.mtx = step({ id: 'mtx', tag: '150/20 kV', name: 'MAIN TX', symbol: 'transformer', sublabel: F('distribution.main_tx_total') + ' × ' + F('distribution.main_tx_mva') + ' MVA' });
    n.mv = step({ id: 'mv', tag: 'mv', name: F('distribution.mv_kv') + ' kV BOARD', symbol: 'switchgear', sublabel: F('distribution.mv_fault_ka_per_section', 1) + ' kA · ' + F('distribution.mv_board_ka_rating', 1) + ' kA gear', tier: 1 });
    n.usub = step({ id: 'usub', tag: '20/0.4 kV', name: 'UNIT SUBS', symbol: 'transformer', sublabel: F('equipment.transformers') + ' × ' + F('equipment.transformer_unit_mva', 1) + ' MVA' });
    n.ups = step({ id: 'ups', tag: 'ups', name: 'UPS', symbol: 'ups', sublabel: F('equipment.ups_frames_total') + ' × ' + F('equipment.ups_frame_kw') + ' kW' });
    n.racks = step({ id: 'racks', tag: 'load', name: 'NVL72 RACKS', symbol: 'rack', sublabel: F('compute.racks_facility') + ' × ' + F('power.rack_it_kw') + ' kW', focal: true, tier: 1 });
    n.genset = node(ctx, n.mv.x + (n.mv.w - 128) / 2, Y - 132, { id: 'genset', tag: 'standby', name: 'GENSETS', symbol: 'genset', w: 128, h: 88, sublabel: F('equipment.gensets_installed') + ' × ' + F('equipment.generator_unit_kw') + ' kW', dashed: true });
    edge(ctx, n.utility, n.gis, { label: F('distribution.hv_current_a') + ' A', state: 'flow', tier: 1 });
    edge(ctx, n.gis, n.mtx, { state: 'flow', tier: 1 });
    edge(ctx, n.mtx, n.mv, { label: F('distribution.main_tx_secondary_a') + ' A', state: 'flow', tier: 1 });
    edge(ctx, n.mv, n.usub, { label: F('distribution.mv_feeder_rated_a') + ' A feeders', state: 'flow', tier: 1 });
    edge(ctx, n.usub, n.ups, { label: F('distribution.voltage_ll_v') + ' V', state: 'flow', tier: 1 });
    edge(ctx, n.ups, n.racks, { label: F('distribution.rack_feed_current_a') + ' A / rack', state: 'flow', tier: 1 });
    edge(ctx, n.genset, n.mv, { from: { x: n.genset.x + n.genset.w / 2, y: n.genset.y + n.genset.h }, to: { x: n.mv.x + n.mv.w / 2, y: n.mv.y }, pattern: 'dashed', label: 'ATS', tier: 2 });
    ctx.zone(n.utility.x - 12, Y - 28, (n.mtx.x + n.mtx.w + 12) - (n.utility.x - 12), H + 56, { label: F('distribution.hv_intake_kv') + ' kV switchyard', tier: 3 });
    n.next = x;
    return n;
  }
  function heatPath(ctx, racks, x, Y, GAP, H) {
    function step(o) { var b = node(ctx, x, Y, Object.assign({ h: H }, o)); x = b.x + b.w + GAP; return b; }
    var n = { racks: racks };
    n.cdu = step({ id: 'cdu', tag: 'l2l', name: 'CDU ARRAY', symbol: 'cdu', sublabel: F('equipment.cdu_installed_facility') + ' × ' + F('equipment.cdu_unit_kwth') + ' kW' });
    n.dry = step({ id: 'dry', tag: 'reject', name: 'DRY COOLERS', symbol: 'dryCooler', sublabel: F('equipment.dry_coolers_installed') + ' × ' + F('equipment.dry_cooler_unit_kwth') + ' kW' });
    n.crah = node(ctx, racks.x, Y + H + 76, { id: 'crah', tag: 'air', name: 'FAN WALLS', symbol: 'crah', w: racks.w, h: H, sublabel: F('heat.air_kwth') + ' kW th air', dashed: true });
    n.chiller = node(ctx, n.cdu.x, Y + H + 76, { id: 'chiller', tag: 'mech', name: 'CHILLERS', symbol: 'chiller', w: n.cdu.w, h: H, sublabel: F('equipment.chillers_installed') + ' × ' + F('equipment.chiller_unit_kwth') + ' kW', dashed: true });
    function pipes(a, b, hot, cold) {
      var ar = L.fanPoints(a, 2, 'right'), bl = L.fanPoints(b, 2, 'left');
      edge(ctx, a, b, { from: ar[0], to: bl[0], stroke: 'alarm-caution', label: hot, state: 'flow', tier: 2 });
      edge(ctx, b, a, { from: bl[1], to: ar[1], stroke: 'link', label: cold, pattern: 'dash-dot', state: 'flow', tier: 2 });
    }
    pipes(racks, n.cdu, 'TCS ' + F('design.planes.p08_tcs_return_c') + ' °C', 'TCS ' + F('design.planes.p07_tcs_supply_c') + ' °C');
    pipes(n.cdu, n.dry, 'HTW ' + F('design.planes.p06_htw_return_c') + ' °C', 'HTW ' + F('design.planes.p05_htw_supply_c') + ' °C');
    edge(ctx, racks, n.crah, { from: { x: racks.x + racks.w / 2, y: racks.y + racks.h }, to: { x: n.crah.x + n.crah.w / 2, y: n.crah.y }, stroke: 'soft', pattern: 'dotted', label: 'air ' + F('design.planes.p11_air_return_c') + ' °C', tier: 3 });
    edge(ctx, n.crah, n.chiller, { label: 'CHW ' + F('design.planes.p12_chw_supply_c') + ' / ' + F('design.planes.p13_chw_return_c') + ' °C', stroke: 'link', pattern: 'dash-dot', state: 'flow', tier: 2 });
    edge(ctx, n.chiller, n.dry, { from: { x: n.chiller.x + n.chiller.w, y: n.chiller.y + n.chiller.h / 2 }, to: { x: n.dry.x + n.dry.w / 2, y: n.dry.y + n.dry.h }, label: 'CDW ' + F('design.planes.p15_cdw_supply_c') + ' / ' + F('design.planes.p16_cdw_return_c') + ' °C', stroke: 'soft', pattern: 'dotted', tier: 3 });
    n.next = x;
    return n;
  }
  /* One figure: electricity in at the left, heat out at the right, the racks where they meet. */
  function figPlant() {
    var ctx = D.create({ width: 1560, height: 440, slug: 'hubplant', title: 'The plant: 150 kV to the rack, rack to ambient',
      desc: 'Utility intake through the GIS, main transformers to 20 kV, unit substations to 400 V, UPS, racks; then the liquid path through CDUs to dry coolers and the air path through fan walls to chillers.' });
    var Y = 150, H = 92;
    var p = powerChain(ctx, 24, Y, 34, H);
    var h = heatPath(ctx, p.racks, p.next + 60, Y, 96, H);
    ctx.zone(p.usub.x - 14, Y - 26, (h.cdu.x + h.cdu.w + 14) - (p.usub.x - 14), (h.chiller.y + h.chiller.h + 26) - (Y - 26), { label: 'inside the building', tier: 3 });
    ctx.fit(20);
    return ctx;
  }
  /* Phones: the same plant as two stacked sheets so the glyphs stay readable. */
  function figPower() {
    var ctx = D.create({ width: 1180, height: 330, slug: 'hubsld', title: 'Power chain, 150 kV to the rack', desc: 'Utility intake to the racks, standby generation on the 20 kV board.' });
    powerChain(ctx, 24, 150, 46, 92); ctx.fit(20); return ctx;
  }
  function figHeat() {
    var ctx = D.create({ width: 1180, height: 330, slug: 'hubcool', title: 'Heat path, rack to ambient', desc: 'Liquid path to dry coolers, air path to chillers.' });
    var racks = node(ctx, 24, 40, { id: 'racks', tag: 'load', name: 'NVL72 RACKS', symbol: 'rack', h: 92, sublabel: F('heat.liquid_kwth') + ' kW th liquid', focal: true, tier: 1 });
    heatPath(ctx, racks, racks.x + racks.w + 118, 40, 118, 92); ctx.fit(20); return ctx;
  }

  /* The campus to scale: the engine's lengths, dimension lines, a scale bar. Hand SVG,
   * because this is geometry in metres and not a block diagram. */
  function figSite() {
    var W = get('site.site_width_m') || 412, Dp = get('site.site_depth_m') || 231;
    var pl = get('site.plate_length_m') || 163, pw = get('site.plate_width_m') || 68, gw = get('site.genset_yard_width_m') || 201;
    var nb = get('site.north_band_depth_m') || 21, sb = get('site.south_band_depth_m') || 81, road = get('site.road_m') || 12, set = get('site.setback_m') || 6;
    var sc = 1060 / W, X0 = 70, Y0 = 36, H = Dp * sc;
    var out = [];
    function r(x, y, w, h, cls, extra) { out.push('<rect x="' + (X0 + x * sc).toFixed(1) + '" y="' + (Y0 + y * sc).toFixed(1) + '" width="' + (w * sc).toFixed(1) + '" height="' + (h * sc).toFixed(1) + '" class="' + cls + '"' + (extra || '') + '/>'); }
    function t(x, y, s, cls, anchor) { out.push('<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" class="' + (cls || 'st') + '" text-anchor="' + (anchor || 'start') + '">' + esc(s) + '</text>'); }
    function dim(x1, y1, x2, y2, s) {
      out.push('<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" class="sd"/>');
      var tick = 5; if (y1 === y2) { out.push('<line x1="' + x1 + '" y1="' + (y1 - tick) + '" x2="' + x1 + '" y2="' + (y1 + tick) + '" class="sd"/><line x1="' + x2 + '" y1="' + (y1 - tick) + '" x2="' + x2 + '" y2="' + (y1 + tick) + '" class="sd"/>'); t((x1 + x2) / 2, y1 - 6, s, 'sm', 'middle'); }
      else { out.push('<line x1="' + (x1 - tick) + '" y1="' + y1 + '" x2="' + (x1 + tick) + '" y2="' + y1 + '" class="sd"/><line x1="' + (x1 - tick) + '" y1="' + y2 + '" x2="' + (x1 + tick) + '" y2="' + y2 + '" class="sd"/>'); out.push('<text x="' + (x1 - 8) + '" y="' + ((y1 + y2) / 2) + '" class="sm" text-anchor="middle" transform="rotate(-90 ' + (x1 - 8) + ' ' + ((y1 + y2) / 2) + ')">' + esc(s) + '</text>'); }
    }
    r(0, 0, W, Dp, 'sl t3');
    r(set, set, W - 2 * set, Dp - 2 * set, 'sl t3', ' stroke-dasharray="2,3"');
    var ix = set + road, iy = set + road, iw = W - 2 * (set + road), id = Dp - 2 * (set + road);
    r(ix, iy, iw, id, 'sl t3');
    var yA = iy, yB = yA + nb + road, yC = yB + pw + road;
    var bands = [['GIS', .22, 'gis'], ['MAIN TX YARD', .30, 'txyard'], ['STP', .08, null], ['FUEL FARM', .40, 'fuel']], bx = ix;
    bands.forEach(function (b) { var w = (iw - road * 3) * b[1]; if (b[2]) out.push('<g data-rzd-hit="' + b[2] + '" class="rzd-hit" tabindex="0" role="button" aria-label="' + b[0] + '">'); r(bx, yA, w, nb, 'sl t2 sf'); t(X0 + (bx + w / 2) * sc, Y0 + (yA + nb / 2) * sc + 3, b[0], 'st', 'middle'); if (b[2]) out.push('</g>'); bx += w + road; });
    out.push('<g data-rzd-hit="campus" class="rzd-hit" tabindex="0" role="button" aria-label="Building plate">');
    r(ix, yB, pl, pw, 'sl t1 sf');
    for (var i = 1; i < 4; i++) out.push('<line x1="' + (X0 + (ix + pl * i / 4) * sc).toFixed(1) + '" y1="' + (Y0 + yB * sc).toFixed(1) + '" x2="' + (X0 + (ix + pl * i / 4) * sc).toFixed(1) + '" y2="' + (Y0 + (yB + pw) * sc).toFixed(1) + '" class="sl t3"/>');
    t(X0 + (ix + pl / 2) * sc, Y0 + (yB + pw / 2) * sc - 4, 'BUILDING · ' + halls() + ' HALLS ON ' + F('site.hall_levels') + ' LEVELS', 'st', 'middle');
    t(X0 + (ix + pl / 2) * sc, Y0 + (yB + pw / 2) * sc + 10, F('site.plate_length_m') + ' × ' + F('site.plate_width_m') + ' m', 'sm', 'middle');
    out.push('</g>');
    var gx = ix + pl + road;
    out.push('<g data-rzd-hit="genset" class="rzd-hit" tabindex="0" role="button" aria-label="Genset yard">');
    r(gx, yB, gw, pw, 'sl t2');
    for (var rr = 0; rr < 3; rr++) for (var c = 0; c < 8; c++) r(gx + 4 + c * (gw - 8) / 8, yB + 4 + rr * (pw - 8) / 3, (gw - 8) / 8 - 3, (pw - 8) / 3 - 3, 'sl t3');
    t(X0 + (gx + gw / 2) * sc, Y0 + (yB + pw + 12) * sc, 'GENSET YARD · ' + F('equipment.gensets_installed') + ' × ' + F('equipment.generator_unit_kw') + ' kW', 'st', 'middle');
    out.push('</g>');
    out.push('<g data-rzd-hit="chiller" class="rzd-hit" tabindex="0" role="button" aria-label="Chiller plant">');
    var cw = iw * .5; r(ix, yC, cw, sb * .5, 'sl t2'); for (var k = 0; k < 12; k++) r(ix + 3 + k * (cw - 6) / 12, yC + 3, (cw - 6) / 12 - 3, sb * .5 - 6, 'sl t3');
    t(X0 + (ix + cw / 2) * sc, Y0 + (yC + sb * .5 + 10) * sc, 'CHILLER PLANT · ' + F('equipment.chillers_installed') + ' × ' + F('equipment.chiller_unit_kwth') + ' kW', 'st', 'middle');
    out.push('</g>');
    out.push('<g data-rzd-hit="dry" class="rzd-hit" tabindex="0" role="button" aria-label="Dry cooler yard">');
    var dx = ix + iw * .52, dw = iw * .48; r(dx, yC, dw, sb, 'sl t2'); for (var m = 0; m < 20; m++) r(dx + 3 + m * (dw - 6) / 20, yC + 3, (dw - 6) / 20 - 2, sb - 6, 'sl t3');
    t(X0 + (dx + dw / 2) * sc, Y0 + (yC + sb + 12) * sc, 'DRY COOLER YARD · ' + F('site.dry_coolers_yard') + ' OF ' + F('equipment.dry_coolers_installed') + ' (REST ON THE ROOF)', 'st', 'middle');
    out.push('</g>');
    dim(X0, Y0 + H + 26, X0 + W * sc, Y0 + H + 26, F('site.site_width_m') + ' m');
    dim(X0 - 30, Y0, X0 - 30, Y0 + H, F('site.site_depth_m') + ' m');
    dim(X0 + ix * sc, Y0 + yB * sc - 10, X0 + (ix + pl) * sc, Y0 + yB * sc - 10, F('site.plate_length_m') + ' m');
    out.push('<g class="sbar"><line x1="' + (X0 + W * sc - 50 * sc) + '" y1="' + (Y0 + H + 50) + '" x2="' + (X0 + W * sc) + '" y2="' + (Y0 + H + 50) + '" class="sd"/>');
    t(X0 + W * sc, Y0 + H + 64, '50 m · engine site ' + F('site.site_area_m2') + ' m²', 'sm', 'end'); out.push('</g>');
    out.push('<text x="' + (X0 + W * sc) + '" y="' + (Y0 - 14) + '" class="sm" text-anchor="end">N ↑ · roads ' + F('site.road_m') + ' m · setback ' + F('site.setback_m') + ' m</text>');
    return { render: function () { return '<svg viewBox="0 0 1200 ' + (Y0 + H + 76).toFixed(0) + '" role="img" aria-label="Campus to scale, engine layout"><rect width="1200" height="' + (Y0 + H + 76).toFixed(0) + '" fill="var(--bg1)"/>' + out.join('') + '</svg>'; }, warnings: [] };
  }

  /* ------------------------------------------------------------------ */
  /* Readout: one node selected at a time, by hover, focus or click       */
  /* ------------------------------------------------------------------ */
  function readout(id, host) {
    var r = ROWS[id], box = $('[data-readout]', host); if (!box) return;
    if (!r) {
      var b = bin();
      box.innerHTML = '<div class="ro-head"><b>The facility, as computed</b><span>' + (b ? 'ambient ' + b.ambient_db_c + ' °C · ' + fmt(b.hours) + ' h a year' : 'design day') + '</span></div><table class="ro-rows">' +
        [['Total IT', F('power.total_it_mw', 2), 'MW'], ['Facility draw', b ? fmt(b.facility_kwe / 1000, 1) : '—', 'MW'], ['PUE at this bin', b ? fmt(b.pue, 3) : '—', ''], ['Chillers running', b ? fmt(b.chillers_running) : '—', ''], ['Racks · GPUs', F('compute.racks_facility') + ' · ' + F('compute.gpu_facility'), ''], ['Free-cooling hours', F('pue.free_cooling_hours') + ' / ' + F('pue.hours_total'), '']]
          .map(function (row) { return '<tr><th>' + row[0] + '</th><td>' + row[1] + (row[2] ? ' <i>' + row[2] + '</i>' : '') + '</td></tr>'; }).join('') + '</table><p class="ro-empty">Hover or tap any box in the drawing to read its rows.</p>';
      return;
    }
    var h = '<div class="ro-head"><b>' + esc(r.title) + '</b><span>' + esc(r.sub || '') + '</span></div><table class="ro-rows">';
    var rows = (id === 'chiller' || id === 'dry' || id === 'cdu' || id === 'crah') ? r.rows.concat(binRows()) : r.rows;
    rows.forEach(function (row) { h += '<tr><th>' + esc(row[0]) + '</th><td>' + esc(row[1]) + (row[2] ? ' <i>' + esc(row[2]) + '</i>' : '') + '</td><td class="ro-id">' + esc(row[3]) + '</td></tr>'; });
    h += '</table><a class="ro-go" href="' + esc(r.href) + '">Open where this is computed <span aria-hidden="true">→</span></a>';
    box.innerHTML = h;
  }
  /* The plant as a graph, declared once: what feeds what. Hovering a node lights its upstream
   * (where its power or heat comes from) in amber, its downstream a little brighter, the rest dim. */
  var DOWN = { utility: ['gis'], gis: ['mtx'], mtx: ['mv'], genset: ['mv'], mv: ['usub'], usub: ['ups'], ups: ['racks'], racks: ['cdu', 'crah'], cdu: ['dry'], crah: ['chiller'], chiller: ['dry'], dry: [] };
  function reach(id, forward) {
    var seen = {}, q = [id];
    while (q.length) { var cur = q.shift(); Object.keys(DOWN).forEach(function (a) { DOWN[a].forEach(function (b) { var nxt = forward ? (a === cur ? b : null) : (b === cur ? a : null); if (nxt && !seen[nxt]) { seen[nxt] = true; q.push(nxt); } }); }); }
    return seen;
  }
  function linked(a, b) { return (DOWN[a] || []).indexOf(b) >= 0 || (DOWN[b] || []).indexOf(a) >= 0; }
  function tip(host, id) {
    var stage = $('[data-stage]', host), t = $('.fp-tip', stage);
    if (!t) { t = document.createElement('div'); t.className = 'fp-tip'; t.setAttribute('aria-hidden', 'true'); stage.appendChild(t); }
    var r = ROWS[id], anchor = id && ($('[data-rzd-node="' + id + '"]', stage) || $('[data-rzd-hit="' + id + '"]', stage));
    if (!r || !anchor) { t.classList.remove('is-on'); return; }
    var rows = (id === 'chiller' || id === 'dry' || id === 'cdu' || id === 'crah') ? binRows().concat(r.rows).slice(0, 4) : r.rows.slice(0, 4);
    t.innerHTML = '<b>' + esc(r.title) + '</b><small>' + esc(r.sub || '') + '</small><table>' + rows.map(function (row) { return '<tr><th>' + esc(row[0]) + '</th><td>' + esc(row[1]) + (row[2] ? ' <i>' + esc(row[2]) + '</i>' : '') + '</td></tr>'; }).join('') + '</table><em>double-click or Enter opens the page →</em>';
    var sb = stage.getBoundingClientRect(), ab = anchor.getBoundingClientRect(), x = ab.right - sb.left + stage.scrollLeft + 12, y = ab.top - sb.top + stage.scrollTop - 4;
    t.classList.add('is-on');
    if (x + 250 > stage.clientWidth + stage.scrollLeft) x = ab.left - sb.left + stage.scrollLeft - 252;
    if (x < stage.scrollLeft + 8) x = stage.scrollLeft + 8;
    if (y + t.offsetHeight > stage.scrollHeight - 8) y = Math.max(8, stage.scrollHeight - t.offsetHeight - 8);
    t.style.left = x + 'px'; t.style.top = y + 'px';
  }
  function wire(host, onTouch) {
    var hot = null;
    function light(id) {
      if (hot === id) return; hot = id;
      $$('.is-hot, .is-dim, .is-up, .is-down', host).forEach(function (e) { e.classList.remove('is-hot'); e.classList.remove('is-dim'); e.classList.remove('is-up'); e.classList.remove('is-down'); });
      if (!id) { readout(null, host); tip(host, null); return; }
      $$('[data-rzd-node="' + id + '"],[data-rzd-sym="' + id + '"],[data-rzd-hit="' + id + '"]', host).forEach(function (e) { e.classList.add('is-hot'); });
      var up = reach(id, false), down = reach(id, true);
      $$('[data-rzd-layer]', host).forEach(function (e) {
        var l = e.getAttribute('data-rzd-layer'), m = /^e:([^>]+)>(.+)$/.exec(l); if (!m) return;
        var a = m[1], b = m[2], touches = a === id || b === id;
        var inUp = (a === id || up[a]) && (b === id || up[b]) && linked(a, b) && !(a === id && down[b]) && !(b === id && down[a]);
        var inDown = (a === id || down[a]) && (b === id || down[b]) && linked(a, b) && !inUp;
        e.classList.add(touches && !inDown ? 'is-hot' : inUp ? 'is-up' : inDown ? 'is-down' : 'is-dim');
      });
      readout(id, host); tip(host, id);
    }
    host.addEventListener('pointerover', function (e) { var h = e.target.closest && e.target.closest('[data-rzd-hit]'); if (h) { light(h.getAttribute('data-rzd-hit')); onTouch(); } });
    host.addEventListener('pointerleave', function () { if (!host.__pinned) light(null); });
    host.addEventListener('focusin', function (e) { var h = e.target.closest && e.target.closest('[data-rzd-hit]'); if (h) { light(h.getAttribute('data-rzd-hit')); onTouch(); } });
    host.addEventListener('click', function (e) {
      var h = e.target.closest && e.target.closest('[data-rzd-hit]'); if (!h) return;
      var id = h.getAttribute('data-rzd-hit'); host.__pinned = id; hot = null; light(id); onTouch();
      var go = ROWS[id] && ROWS[id].href; if (go && e.detail >= 2) window.location.href = go;
    });
    host.addEventListener('keydown', function (e) { var h = e.target.closest && e.target.closest('[data-rzd-hit]'); if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); var go = ROWS[h.getAttribute('data-rzd-hit')]; if (go) window.location.href = go.href; } });
    host.__light = light;
    light(null);
  }

  /* The figure draws itself left to right: every element is staggered by where it sits. */
  function stagger(stage) {
    if (REDUCE) return;
    var base = 0;
    $$('svg', stage).forEach(function (svg) {
      var maxI = 0;
      $$(':scope > *', svg).forEach(function (el) {
        var i = 0; try { i = Math.round(el.getBBox().x / 48); } catch (err) { i = 0; }
        if (!isFinite(i) || i < 0) i = 0; if (i > maxI) maxI = i;
        el.style.setProperty('--i', base + i);
      });
      base += maxI + 4;
    });
    stage.classList.remove('is-draw'); void stage.offsetWidth; stage.classList.add('is-draw');
  }

  /* ------------------------------------------------------------------ */
  /* The hero: keys, the year strip, the figure, the readout             */
  /* ------------------------------------------------------------------ */
  var KEYS = [
    { k: 'ambient', label: 'Ambient', id: function () { return 'bins[' + BIN + '].ambient_db_c'; }, val: function (b) { return b.ambient_db_c; }, out: function (v) { return fmt(v) + ' °C'; } },
    { k: 'pue', label: 'PUE at this bin', id: function () { return 'bins[' + BIN + '].pue'; }, val: function (b) { return b.pue; }, out: function (v) { return fmt(v, 3); } },
    { k: 'facility', label: 'Facility draw', id: function () { return 'bins[' + BIN + '].facility_kwe'; }, val: function (b) { return b.facility_kwe / 1000; }, out: function (v) { return fmt(v, 1) + ' MW'; } },
    { k: 'chillers', label: 'Chillers running', id: function () { return 'bins[' + BIN + '].chillers_running'; }, val: function (b) { return b.chillers_running; }, out: function (v) { return fmt(Math.round(v)) + ' of ' + F('equipment.chillers_installed'); } },
    { k: 'liquid', label: 'Liquid path', id: function () { return 'bins[' + BIN + '].liquid_free_cooling'; }, val: function (b) { return b.liquid_free_cooling; }, out: function (v) { return v ? 'free cooling' : 'on compressors'; } },
    { k: 'it', label: 'Total IT', id: function () { return 'power.total_it_mw'; }, val: function () { return get('power.total_it_mw'); }, out: function (v) { return fmt(v, 2) + ' MW'; } },
    { k: 'gpu', label: 'GPUs', id: function () { return 'compute.gpu_facility'; }, val: function () { return get('compute.gpu_facility'); }, out: function (v) { return fmt(Math.round(v)); } }
  ];
  function keysRender(list) {
    list.innerHTML = KEYS.map(function (k, i) { return '<li style="--i:' + i + '" data-key-row="' + k.k + '"><span>' + esc(k.label) + '</span><b data-key="' + k.k + '">—</b><code>' + esc(k.id()) + '</code></li>'; }).join('');
  }
  function keysPaint(list) {
    var b = bin(); if (!b) return;
    KEYS.forEach(function (k) {
      var el = $('[data-key="' + k.k + '"]', list), row = el && el.parentNode, v = k.val(b);
      if (!el) return;
      $('code', row).textContent = k.id();
      if (typeof v === 'number' && k.k !== 'chillers' && k.k !== 'gpu') tween(el, v, k.out); else el.textContent = k.out(v);
      if (k.k === 'liquid' || k.k === 'chillers' || k.k === 'pue') row.classList.toggle('is-warn', !b.liquid_free_cooling);
    });
  }
  function yearRender(strip) {
    var bs = bins(), total = 0; bs.forEach(function (b) { total += b.hours; });
    strip.innerHTML = bs.map(function (b, i) {
      return '<button type="button" data-bin="' + i + '" style="--h:' + (b.hours / total).toFixed(4) + '" aria-pressed="' + (i === BIN ? 'true' : 'false') + '" title="' + b.ambient_db_c + ' °C dry bulb, ' + fmt(b.hours) + ' h a year">' +
        '<b>' + b.ambient_db_c + ' °C</b><span>' + fmt(b.hours) + ' h' + (i === DESIGN_BIN ? ' · design' : '') + (b.liquid_free_cooling ? '' : ' · cliff') + '</span><i class="dwell" aria-hidden="true"></i></button>';
    }).join('');
  }

  function mountHero() {
    var host = $('#plant'); if (!host || !D || !L) return;
    var stage = $('[data-stage]', host), tabs = $$('[data-fig]', host), caps = {}, list = $('#heroKeys'), strip = $('#yearStrip');
    var FIGS = { plant: function () { return NARROW.matches ? [figPower(), figHeat()] : [figPlant()]; }, site: function () { return [figSite()]; } }, cache = {};
    var current = 'plant', timer = null, idleUntil = 0, inView = true, playing = !REDUCE && bins().length > 1;
    $$('[data-fig-cap]', host).forEach(function (c) { caps[c.getAttribute('data-fig-cap')] = c; });

    function paintState() {
      var b = bin(); if (!b) return;
      var design = get('equipment.chillers_running_design'), warn = typeof design === 'number' && b.chillers_running > design;
      $$('[data-rzd-node="chiller"]', host).forEach(function (n) { n.classList.toggle('is-warn', warn); });
      host.classList.toggle('is-cliff', !b.liquid_free_cooling);
      $$('[data-bin]', strip).forEach(function (x) { x.setAttribute('aria-pressed', +x.getAttribute('data-bin') === BIN ? 'true' : 'false'); });
      keysPaint(list);
      readout(host.__pinned || null, host);
    }
    function show(name) {
      current = name;
      tabs.forEach(function (t) { var on = t.getAttribute('data-fig') === name; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; });
      for (var k in caps) caps[k].hidden = k !== name;
      var key = name + (NARROW.matches ? ':narrow' : '');
      if (!cache[key]) cache[key] = FIGS[name]().map(function (ctx) { if (ctx.warnings && ctx.warnings.length) console.warn('[plant ' + name + ']', ctx.warnings); return ctx.render(); }).join('');
      stage.innerHTML = cache[key];
      $$('svg', stage).forEach(function (sv) { sv.setAttribute('role', 'group'); sv.removeAttribute('aria-labelledby'); sv.setAttribute('aria-label', (name === 'site' ? 'Campus to scale' : 'The plant') + ' — interactive drawing'); });
      /* the IEC genset glyph carries its G as a 13-unit letter; at this figure's scale that is a 6 px
       * glyph, so it is drawn as a stroke here — same symbol, a path instead of a text node */
      $$('g.rzd-sym text', stage).forEach(function (t) {
        if (t.textContent.trim() !== 'G') return;
        var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', 'M38.6 22.2 A5.8 5.8 0 1 0 39.8 26.8 H35'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '2');
        t.parentNode.replaceChild(p, t);
      });
      host.setAttribute('data-fig-on', name); host.__pinned = null;
      if (host.__light) { host.__light(null); }
      stagger(stage); paintState();
    }
    tabs.forEach(function (t) { t.addEventListener('click', function () { show(t.getAttribute('data-fig')); touch(); }); });
    host.addEventListener('keydown', function (e) {
      if (!e.target.hasAttribute('data-fig')) return; var i = tabs.indexOf(e.target), n = tabs.length;
      if (e.key === 'ArrowRight') { tabs[(i + 1) % n].focus(); show(tabs[(i + 1) % n].getAttribute('data-fig')); }
      if (e.key === 'ArrowLeft') { tabs[(i - 1 + n) % n].focus(); show(tabs[(i - 1 + n) % n].getAttribute('data-fig')); }
    });
    if (NARROW.addEventListener) NARROW.addEventListener('change', function () { show(current); });

    /* The year plays through the figure. Any touch from the reader pauses it; it resumes
     * after a quiet while. Off-screen or in a hidden tab it does not run. */
    function setBin(i) { BIN = i; paintState(); }
    function touch() { idleUntil = Date.now() + IDLE; strip.classList.add('is-paused'); }
    function tick() {
      timer = null; if (!playing) return;
      if (!inView || document.hidden || Date.now() < idleUntil) { strip.classList.toggle('is-paused', Date.now() < idleUntil); timer = setTimeout(tick, 400); return; }
      strip.classList.remove('is-paused');
      setBin((BIN + 1) % bins().length);
      timer = setTimeout(tick, DWELL);
    }
    strip.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-bin]'); if (b) { setBin(+b.getAttribute('data-bin')); touch(); } });
    strip.addEventListener('pointerover', function (e) { var b = e.target.closest && e.target.closest('[data-bin]'); if (b) { setBin(+b.getAttribute('data-bin')); touch(); } });
    strip.addEventListener('focusin', function (e) { var b = e.target.closest && e.target.closest('[data-bin]'); if (b) { setBin(+b.getAttribute('data-bin')); touch(); } });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { inView = es[0].isIntersecting; }, { threshold: 0.15 }).observe(host);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && playing && !timer) tick(); });

    keysRender(list); yearRender(strip); wire(host, touch); show('plant');
    if (playing) timer = setTimeout(tick, DWELL + 1200);
  }

  /* Catalogue rows arrive in a short stagger as each group scrolls in. */
  function reveal() {
    if (REDUCE || !('IntersectionObserver' in window)) return;
    var groups = $$('.tgrp'); if (!groups.length) return;
    groups.forEach(function (g) { $$('.tool', g).forEach(function (t, i) { t.style.setProperty('--i', i); }); g.classList.add('is-pending'); });
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    groups.forEach(function (g) { io.observe(g); });
  }

  function stamp() { $$('[data-engine-stamp]').forEach(function (e) { e.textContent = 'numbers: DC AI engine v' + (S && S.meta && S.meta.version || '—') + ' · ' + (S && S.meta && S.meta.spec_version || ''); }); }

  /* ------------------------------------------------------------------ */
  /* Micro-interactions: the tab ink, j/k over the list, copy a key's id  */
  /* ------------------------------------------------------------------ */
  function ink() {
    $$('.fp-tabs').forEach(function (bar) {
      var i = document.createElement('i'); i.className = 'fp-ink'; bar.appendChild(i); bar.classList.add('has-ink');
      function place() { var on = $('.fp-tab[aria-selected="true"]', bar); if (!on) return; var b = bar.getBoundingClientRect(), r = on.getBoundingClientRect(); i.style.width = r.width + 'px'; i.style.transform = 'translateX(' + (r.left - b.left) + 'px)'; }
      new MutationObserver(place).observe(bar, { attributes: true, subtree: true, attributeFilter: ['aria-selected'] });
      if ('ResizeObserver' in window) new ResizeObserver(place).observe(bar);
      place();
    });
  }
  function keysNav() {
    var rows = $$('.tool'); if (!rows.length) return;
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target, tag = t && t.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      if (e.key !== 'j' && e.key !== 'k') return;
      var cur = rows.indexOf(document.activeElement), next = e.key === 'j' ? Math.min(rows.length - 1, cur + 1) : Math.max(0, cur < 0 ? 0 : cur - 1);
      e.preventDefault(); rows.forEach(function (r) { r.classList.remove('is-cursor'); }); rows[next].classList.add('is-cursor'); rows[next].focus({ preventScroll: false });
    });
    rows.forEach(function (r) { r.addEventListener('blur', function () { r.classList.remove('is-cursor'); }); });
  }
  function copyKeys() {
    var list = $('#heroKeys'); if (!list) return;
    list.addEventListener('click', function (e) {
      var li = e.target.closest('li'); if (!li) return; var code = $('code', li), id = code.textContent;
      function done() { var was = code.textContent; code.textContent = 'copied ' + id; li.classList.add('is-copied'); setTimeout(function () { code.textContent = was; li.classList.remove('is-copied'); }, 1400); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(id).then(done, done); else done();
    });
    $$('li', list).forEach(function (li) { li.title = 'click to copy the registry id'; });
  }
  function kchip() { var b = $('[data-kchip]'); if (!b) return; b.addEventListener('click', function () { var s = $('#navSearchBtn'); if (s) s.click(); }); }

  function init() { mountHero(); reveal(); stamp(); ink(); keysNav(); copyKeys(); kchip(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
