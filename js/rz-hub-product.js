/* rz-hub-product.js — the DC Solutions hub as a product page (PLAN H1, take 3, 2026-10-16).
 *
 * Borrowed from the references the owner approved (Oxide Computer, Linear) and read live:
 *   - a small live panel with tabs whose leader line names the figure ("FIG. 1"),
 *   - the product itself as the hero render (here: the real cockpit, screenshotted),
 *   - feature columns that each carry a LIVE vignette, not an icon,
 *   - spec tables, two-tone headlines.
 *
 * Everything drawn here is drawn by the site's own engines: RZDiagram lays out the
 * figures (measured boxes, routed connectors, IEC 60617 / ISA-5.1 glyphs from
 * rz-eng-symbols.js), DCAI_CALC.snapshot supplies every number. A number the engine
 * does not publish prints "—". Nothing follows the cursor; hover and focus select,
 * click navigates. ES5, zero deps beyond the engines.
 */
(function () {
  'use strict';
  if (window.__rzHubProduct) return; window.__rzHubProduct = true;

  var S = window.DCAI_CALC && window.DCAI_CALC.snapshot;
  var D = window.RZDiagram, L = window.RZDiagramLayout;
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  /* ------------------------------------------------------------------ */
  /* The readout rows behind every node: label · value · registry id      */
  /* ------------------------------------------------------------------ */
  var BIN = 5; /* index into S.bins — the design day until a scenario button says otherwise */
  function bin() { return S && S.bins && S.bins[BIN] || null; }
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
    chiller: { title: 'Chillers', sub: 'air path only; the liquid path runs free', href: 'pue-calculator.html', rows: [
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
  /* FIG. 1 — three drawings through RZDiagram                            */
  /* ------------------------------------------------------------------ */
  function mid(box, side) { return L.fanPoints(box, 1, side)[0]; }
  function node(ctx, x, y, o) { o.interactive = true; if (!o.tier) o.tier = 2; return ctx.node(x, y, o); }
  function edge(ctx, a, b, o) {
    o = o || {}; o.fromId = a.id; o.toId = b.id;
    var from = o.from || mid(a, o.fromSide || 'right'), to = o.to || mid(b, o.toSide || 'left');
    ctx.layer('e:' + a.id + '>' + b.id);
    ctx.edge({ x: from.x, y: from.y }, { x: to.x, y: to.y }, o);
    ctx.layer(null);
  }

  function figSld() {
    var ctx = D.create({ width: 1180, height: 330, slug: 'hubsld', title: 'Power chain, 150 kV to the rack',
      desc: 'Utility intake at 150 kV through the GIS, main transformers to 20 kV, unit substations to 400 V, UPS, racks. Standby generation on the 20 kV board.' });
    var Y = 150, x = 24, GAP = 46, H = 92;
    function step(o) { var b = node(ctx, x, Y, Object.assign({ h: H }, o)); x = b.x + b.w + GAP; return b; }
    var utility = step({ id: 'utility', tag: 'grid', name: 'PLN ' + F('distribution.hv_intake_kv') + ' kV', symbol: 'utility', sublabel: F('distribution.hv_circuits_installed') + ' circuits × ' + F('distribution.hv_circuit_mva') + ' MVA' });
    var gis = step({ id: 'gis', tag: 'hv', name: 'GIS', symbol: 'switchgear', sublabel: F('distribution.hv_switchyard_bays') + ' bays' });
    var mtx = step({ id: 'mtx', tag: '150/20 kV', name: 'MAIN TX', symbol: 'transformer', sublabel: F('distribution.main_tx_total') + ' × ' + F('distribution.main_tx_mva') + ' MVA' });
    var mv = step({ id: 'mv', tag: 'mv', name: F('distribution.mv_kv') + ' kV BOARD', symbol: 'switchgear', sublabel: F('distribution.mv_fault_ka_per_section', 1) + ' kA · ' + F('distribution.mv_board_ka_rating', 1) + ' kA gear', focal: true, tier: 1 });
    var usub = step({ id: 'usub', tag: '20/0.4 kV', name: 'UNIT SUBS', symbol: 'transformer', sublabel: F('equipment.transformers') + ' × ' + F('equipment.transformer_unit_mva', 1) + ' MVA' });
    var ups = step({ id: 'ups', tag: 'ups', name: 'UPS', symbol: 'ups', sublabel: F('equipment.ups_frames_total') + ' × ' + F('equipment.ups_frame_kw') + ' kW' });
    var racks = step({ id: 'racks', tag: 'load', name: 'NVL72 RACKS', symbol: 'rack', sublabel: F('compute.racks_facility') + ' × ' + F('power.rack_it_kw') + ' kW' });
    var genset = node(ctx, mv.x + (mv.w - 128) / 2, 18, { id: 'genset', tag: 'standby', name: 'GENSETS', symbol: 'genset', w: 128, h: 88, sublabel: F('equipment.gensets_installed') + ' × ' + F('equipment.generator_unit_kw') + ' kW', dashed: true });
    edge(ctx, utility, gis, { label: F('distribution.hv_current_a') + ' A', state: 'flow', tier: 1 });
    edge(ctx, gis, mtx, { state: 'flow', tier: 1 });
    edge(ctx, mtx, mv, { label: F('distribution.main_tx_secondary_a') + ' A', state: 'flow', tier: 1 });
    edge(ctx, mv, usub, { label: F('distribution.mv_feeder_rated_a') + ' A feeders', state: 'flow', tier: 1 });
    edge(ctx, usub, ups, { label: F('distribution.voltage_ll_v') + ' V', state: 'flow', tier: 1 });
    edge(ctx, ups, racks, { label: F('distribution.rack_feed_current_a') + ' A / rack', state: 'flow', tier: 1 });
    edge(ctx, genset, mv, { from: { x: genset.x + genset.w / 2, y: genset.y + genset.h }, to: { x: mv.x + mv.w / 2, y: mv.y }, pattern: 'dashed', label: 'ATS', tier: 2 });
    ctx.zone(utility.x - 12, Y - 28, (mtx.x + mtx.w + 12) - (utility.x - 12), H + 56, { label: F('distribution.hv_intake_kv') + ' kV switchyard', tier: 3 });
    ctx.fit(20);
    return ctx;
  }

  function figCooling() {
    var ctx = D.create({ width: 1180, height: 330, slug: 'hubcool', title: 'Heat path, rack to ambient',
      desc: 'Liquid path: racks to CDUs to dry coolers, warm water, no chiller. Air path: fan walls to chillers for the share the liquid does not take.' });
    var Y = 40, x = 24, GAP = 118, H = 92;
    function step(o) { var b = node(ctx, x, Y, Object.assign({ h: H }, o)); x = b.x + b.w + GAP; return b; }
    var racks = step({ id: 'racks', tag: 'load', name: 'NVL72 RACKS', symbol: 'rack', sublabel: F('heat.liquid_kwth') + ' kW th liquid' });
    var cdu = step({ id: 'cdu', tag: 'l2l', name: 'CDU ARRAY', symbol: 'cdu', sublabel: F('equipment.cdu_installed_facility') + ' × ' + F('equipment.cdu_unit_kwth') + ' kW', focal: true, tier: 1 });
    var dry = step({ id: 'dry', tag: 'reject', name: 'DRY COOLERS', symbol: 'dryCooler', sublabel: F('equipment.dry_coolers_installed') + ' × ' + F('equipment.dry_cooler_unit_kwth') + ' kW' });
    var crah = node(ctx, racks.x, Y + H + 76, { id: 'crah', tag: 'air', name: 'FAN WALLS', symbol: 'crah', w: racks.w, h: H, sublabel: F('heat.air_kwth') + ' kW th air', dashed: true });
    var chiller = node(ctx, cdu.x, Y + H + 76, { id: 'chiller', tag: 'mech', name: 'CHILLERS', symbol: 'chiller', w: cdu.w, h: H, sublabel: F('equipment.chillers_installed') + ' × ' + F('equipment.chiller_unit_kwth') + ' kW', dashed: true });
    function pipes(a, b, hot, cold) {
      var ar = L.fanPoints(a, 2, 'right'), bl = L.fanPoints(b, 2, 'left');
      edge(ctx, a, b, { from: ar[0], to: bl[0], stroke: 'alarm-caution', label: hot, state: 'flow', tier: 2 });
      edge(ctx, b, a, { from: bl[1], to: ar[1], stroke: 'link', label: cold, pattern: 'dash-dot', state: 'flow', tier: 2 });
    }
    pipes(racks, cdu, 'TCS ' + F('design.planes.p08_tcs_return_c') + ' °C', 'TCS ' + F('design.planes.p07_tcs_supply_c') + ' °C');
    pipes(cdu, dry, 'HTW ' + F('design.planes.p06_htw_return_c') + ' °C', 'HTW ' + F('design.planes.p05_htw_supply_c') + ' °C');
    edge(ctx, racks, crah, { from: { x: racks.x + racks.w / 2, y: racks.y + racks.h }, to: { x: crah.x + crah.w / 2, y: crah.y }, stroke: 'soft', pattern: 'dotted', label: 'air ' + F('design.planes.p11_air_return_c') + ' °C', tier: 3 });
    edge(ctx, crah, chiller, { label: 'CHW ' + F('design.planes.p12_chw_supply_c') + ' / ' + F('design.planes.p13_chw_return_c') + ' °C', stroke: 'link', pattern: 'dash-dot', tier: 2 });
    edge(ctx, chiller, dry, { from: { x: chiller.x + chiller.w, y: chiller.y + chiller.h / 2 }, to: { x: dry.x + dry.w / 2, y: dry.y + dry.h }, label: 'CDW ' + F('design.planes.p15_cdw_supply_c') + ' / ' + F('design.planes.p16_cdw_return_c') + ' °C', stroke: 'soft', pattern: 'dotted', tier: 3 });
    ctx.zone(racks.x - 14, Y - 26, (cdu.x + cdu.w + 14) - (racks.x - 14), (chiller.y + chiller.h + 26) - (Y - 26), { label: 'inside the building', tier: 3 });
    ctx.fit(20);
    return ctx;
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
    r(0, 0, W, Dp, 'sl t3');                                                /* property line */
    r(set, set, W - 2 * set, Dp - 2 * set, 'sl t3', ' stroke-dasharray="2,3"'); /* fence */
    var ix = set + road, iy = set + road, iw = W - 2 * (set + road), id = Dp - 2 * (set + road);
    r(ix, iy, iw, id, 'sl t3');                                             /* ring road inner edge */
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
        [['Total IT', F('power.total_it_mw', 2), 'MW'], ['Facility draw', b ? fmt(b.facility_kwe / 1000, 1) : '\u2014', 'MW'], ['PUE at this bin', b ? fmt(b.pue, 3) : '\u2014', ''], ['Chillers running', b ? fmt(b.chillers_running) : '\u2014', ''], ['Racks · GPUs', F('compute.racks_facility') + ' · ' + F('compute.gpu_facility'), ''], ['Free-cooling hours', F('pue.free_cooling_hours') + ' / ' + F('pue.hours_total'), '']]
          .map(function (row) { return '<tr><th>' + row[0] + '</th><td>' + row[1] + (row[2] ? ' <i>' + row[2] + '</i>' : '') + '</td></tr>'; }).join('') + '</table>';
      return;
    }
    var h = '<div class="ro-head"><b>' + esc(r.title) + '</b><span>' + esc(r.sub || '') + '</span></div><table class="ro-rows">';
    var rows = (id === 'chiller' || id === 'dry' || id === 'cdu' || id === 'crah') ? r.rows.concat(binRows()) : r.rows;
    rows.forEach(function (row) { h += '<tr><th>' + esc(row[0]) + '</th><td>' + esc(row[1]) + (row[2] ? ' <i>' + esc(row[2]) + '</i>' : '') + '</td><td class="ro-id">' + esc(row[3]) + '</td></tr>'; });
    h += '</table><a class="ro-go" href="' + esc(r.href) + '">Open where this is computed <span aria-hidden="true">→</span></a>';
    box.innerHTML = h;
  }
  function wire(host) {
    var hot = null;
    function light(id) {
      if (hot === id) return; hot = id;
      $$('.is-hot', host).forEach(function (e) { e.classList.remove('is-hot'); });
      $$('.is-dim', host).forEach(function (e) { e.classList.remove('is-dim'); });
      if (!id) { readout(null, host); return; }
      $$('[data-rzd-node="' + id + '"],[data-rzd-sym="' + id + '"],[data-rzd-hit="' + id + '"]', host).forEach(function (e) { e.classList.add('is-hot'); });
      $$('[data-rzd-layer]', host).forEach(function (e) {
        var l = e.getAttribute('data-rzd-layer'); var on = l.indexOf('e:' + id + '>') === 0 || l.slice(-(id.length + 1)) === '>' + id;
        e.classList.add(on ? 'is-hot' : 'is-dim');
      });
      readout(id, host);
    }
    host.addEventListener('pointerover', function (e) { var h = e.target.closest && e.target.closest('[data-rzd-hit]'); if (h) light(h.getAttribute('data-rzd-hit')); });
    host.addEventListener('pointerleave', function () { if (!host.__pinned) light(null); });
    host.addEventListener('focusin', function (e) { var h = e.target.closest && e.target.closest('[data-rzd-hit]'); if (h) light(h.getAttribute('data-rzd-hit')); });
    host.addEventListener('click', function (e) {
      var h = e.target.closest && e.target.closest('[data-rzd-hit]'); if (!h) return;
      var id = h.getAttribute('data-rzd-hit'); host.__pinned = id; light(id);
      var go = ROWS[id] && ROWS[id].href; if (go && e.detail >= 2) window.location.href = go;
    });
    host.addEventListener('keydown', function (e) { var h = e.target.closest && e.target.closest('[data-rzd-hit]'); if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); var go = ROWS[h.getAttribute('data-rzd-hit')]; if (go) window.location.href = go.href; } });
    light(null);
  }

  function mountFigures() {
    var host = $('#fig1'); if (!host || !D || !L) return;
    var stage = $('[data-stage]', host), tabs = $$('[data-fig]', host), caps = {};
    var FIGS = { sld: figSld, cooling: figCooling, site: figSite }, cache = {};
    $$('[data-fig-cap]', host).forEach(function (c) { caps[c.getAttribute('data-fig-cap')] = c; });
    function show(name) {
      tabs.forEach(function (t) { var on = t.getAttribute('data-fig') === name; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; });
      for (var k in caps) caps[k].hidden = k !== name;
      if (!cache[name]) { var ctx = FIGS[name](); cache[name] = ctx.render(); if (ctx.warnings && ctx.warnings.length) console.warn('[fig1 ' + name + ']', ctx.warnings); }
      stage.innerHTML = cache[name]; var sv = stage.querySelector('svg'); if (sv) { sv.setAttribute('role', 'group'); sv.removeAttribute('aria-labelledby'); sv.setAttribute('aria-label', (FIGS[name] === figSite ? 'Campus to scale' : name === 'sld' ? 'Power chain' : 'Heat path') + ' — interactive drawing'); } host.setAttribute('data-fig-on', name); host.__pinned = null; readout(null, host); if (host.__afterShow) host.__afterShow();
      if (!REDUCE) { stage.classList.remove('is-in'); void stage.offsetWidth; stage.classList.add('is-in'); }
    }
    tabs.forEach(function (t) { t.addEventListener('click', function () { show(t.getAttribute('data-fig')); }); });
    host.addEventListener('keydown', function (e) {
      if (!e.target.hasAttribute('data-fig')) return; var i = tabs.indexOf(e.target), n = tabs.length;
      if (e.key === 'ArrowRight') { tabs[(i + 1) % n].focus(); show(tabs[(i + 1) % n].getAttribute('data-fig')); }
      if (e.key === 'ArrowLeft') { tabs[(i - 1 + n) % n].focus(); show(tabs[(i - 1 + n) % n].getAttribute('data-fig')); }
    });
    function status() {
      var b = bin(), st = $('[data-scen-status]', host); if (!st || !b) return;
      var design = get('equipment.chillers_running_design'), warn = typeof design === 'number' && b.chillers_running > design;
      st.innerHTML = 'PUE <b>' + fmt(b.pue, 3) + '</b> · facility <b>' + fmt(b.facility_kwe / 1000, 1) + ' MW</b> · chillers <b class="' + (warn ? 'warn' : '') + '">' + fmt(b.chillers_running) + (warn ? ' — liquid path on compressors' : '') + '</b>';
      $$('[data-rzd-node="chiller"]', host).forEach(function (n) { n.classList.toggle('is-warn', warn); });
      if (!host.__pinned) readout(null, host); else readout(host.__pinned, host);
    }
    $$('[data-scen]', host).forEach(function (btn) {
      btn.addEventListener('click', function () {
        BIN = +btn.getAttribute('data-scen');
        $$('[data-scen]', host).forEach(function (x) { x.setAttribute('aria-pressed', x === btn ? 'true' : 'false'); });
        status();
      });
    });
    wire(host); show('sld'); status();
    host.__afterShow = status;
  }

  /* ------------------------------------------------------------------ */
  /* Vignettes — the feature columns' live panels                        */
  /* ------------------------------------------------------------------ */
  function vignettePue() {
    var host = $('#vgPue'); if (!host) return;
    var bins = (S && S.bins) || []; if (!bins.length) { host.innerHTML = '<p class="ro-empty">—</p>'; return; }
    var W = 300, H = 120, pad = 26, lo = 1.10, hi = 1.30;
    var xs = function (i) { return pad + i * (W - pad - 8) / (bins.length - 1); }, ys = function (v) { return H - 18 - (v - lo) / (hi - lo) * (H - 30); };
    var d = ''; bins.forEach(function (b, i) { var x = xs(i), y = ys(b.pue); d += (i ? ' H' + x.toFixed(1) + ' V' + y.toFixed(1) : 'M' + x.toFixed(1) + ' ' + y.toFixed(1)); });
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="vg-chart" role="img" aria-label="PUE by weather bin">';
    [1.12, 1.20, 1.25].forEach(function (g) { svg += '<line x1="' + pad + '" y1="' + ys(g) + '" x2="' + (W - 8) + '" y2="' + ys(g) + '" class="vg-grid"/><text x="' + (pad - 4) + '" y="' + (ys(g) + 3) + '" class="vg-ax" text-anchor="end">' + g.toFixed(2) + '</text>'; });
    svg += '<path d="' + d + '" class="vg-line"/>';
    bins.forEach(function (b, i) { svg += '<circle cx="' + xs(i) + '" cy="' + ys(b.pue) + '" r="2.5" class="vg-dot' + (b.liquid_free_cooling ? '' : ' is-cliff') + '"/><text x="' + xs(i) + '" y="' + (H - 4) + '" class="vg-ax" text-anchor="middle">' + b.ambient_db_c + '°</text>'; });
    svg += '</svg>';
    var rows = '<table class="vg-rows">' + bins.map(function (b) { return '<tr' + (b.liquid_free_cooling ? '' : ' class="is-cliff"') + '><th>' + b.ambient_db_c + ' °C</th><td>' + fmt(b.pue, 3) + '</td><td>' + fmt(b.hours) + ' h</td><td>' + fmt(b.chillers_running) + ' chillers</td></tr>'; }).join('') + '</table>';
    host.innerHTML = svg + rows;
  }
  function vignettePlanes() {
    var host = $('#vgPlanes'); if (!host) return;
    var P = (S && S.design && S.design.planes) || {};
    var keys = [['p00_ambient_db_c', 'ambient'], ['p02_dry_cooler_leaving_c', 'dry cooler out'], ['p05_htw_supply_c', 'HTW supply'], ['p07_tcs_supply_c', 'TCS supply'], ['p08_tcs_return_c', 'TCS return'], ['p06_htw_return_c', 'HTW return'], ['p09_air_supply_c', 'air supply'], ['p11_air_return_c', 'air return'], ['p12_chw_supply_c', 'CHW supply']];
    var lo = 14, hi = 54, W = 300, H = 168;
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="vg-chart" role="img" aria-label="Temperature planes">';
    svg += '<line x1="40" y1="8" x2="40" y2="' + (H - 8) + '" class="vg-grid"/>';
    /* Hottest at the top. Labels keep a 12-unit pitch and never leave the frame: each one sits
     * at its temperature unless the one above forces it down. */
    var items = keys.map(function (k) { return { v: P[k[0]], l: k[1] }; }).filter(function (i) { return typeof i.v === 'number'; }).sort(function (a, b) { return b.v - a.v; });
    var last = -Infinity;
    items.forEach(function (it) {
      var y = Math.max(10, H - 8 - (it.v - lo) / (hi - lo) * (H - 18)); if (y < last + 13) y = last + 13; last = y;
      svg += '<line x1="40" y1="' + y.toFixed(1) + '" x2="46" y2="' + y.toFixed(1) + '" class="vg-grid"/><circle cx="40" cy="' + y.toFixed(1) + '" r="2.5" class="vg-dot"/><text x="34" y="' + (y + 3).toFixed(1) + '" class="vg-ax" text-anchor="end">' + it.v + '°</text><text x="50" y="' + (y + 3).toFixed(1) + '" class="vg-lbl">' + esc(it.l) + '</text>';
    });
    svg += '</svg>';
    host.innerHTML = svg + '<p class="vg-note">Free-cooling margin at the design day <b>' + F('design.planes.p04_free_cooling_margin_k', 1) + ' K</b> — the liquid path sits on the cliff at ' + F('pue.free_cooling_cliff_ambient_c') + ' °C.</p>';
  }
  function vignetteCapacity() {
    var host = $('#vgCapacity'); if (!host) return;
    host.innerHTML = '<table class="vg-rows vg-spec">' + [
      ['Halls', halls(), ''],
      ['Racks', F('compute.racks_facility'), ''], ['GPUs', F('compute.gpu_facility'), ''],
      ['Rack IT', F('power.rack_it_kw'), 'kW'], ['Total IT', F('power.total_it_mw', 2), 'MW'],
      ['PUE, design day', F('pue.design_day', 3), ''], ['PUE, annual', F('pue.annual_bin_weighted', 3), ''],
      ['Free cooling', fmt((get('pue.free_cooling_fraction') || 0) * 100, 1), '% of hours'],
      ['Water', '0', 'L/kWh']].map(function (r) { return '<tr><th>' + r[0] + '</th><td>' + r[1] + (r[2] ? ' <i>' + r[2] + '</i>' : '') + '</td></tr>'; }).join('') + '</table>';
  }
  function vignetteFleet() {
    var host = $('#vgFleet'); if (!host) return;
    host.innerHTML = '<table class="vg-rows vg-spec">' + [
      ['Main transformers', F('distribution.main_tx_total') + ' × ' + F('distribution.main_tx_mva') + ' MVA'],
      ['Unit substations', F('equipment.transformers') + ' × ' + F('equipment.transformer_unit_mva', 1) + ' MVA'],
      ['UPS frames', F('equipment.ups_frames_total') + ' × ' + F('equipment.ups_frame_kw') + ' kW'],
      ['Gensets', F('equipment.gensets_installed') + ' × ' + F('equipment.generator_unit_kw') + ' kW'],
      ['CDUs', F('equipment.cdu_installed_facility') + ' × ' + F('equipment.cdu_unit_kwth') + ' kW'],
      ['Fan-wall modules', F('equipment.crah_installed_facility') + ' × ' + F('equipment.crah_unit_kwth') + ' kW'],
      ['Chillers', F('equipment.chillers_installed') + ' × ' + F('equipment.chiller_unit_kwth') + ' kW'],
      ['Dry coolers', F('equipment.dry_coolers_installed') + ' × ' + F('equipment.dry_cooler_unit_kwth') + ' kW']].map(function (r) { return '<tr><th>' + r[0] + '</th><td>' + r[1] + '</td></tr>'; }).join('') + '</table>';
  }

  /* Hero: the keys list on the left and the cockpit render on the right, joined by leader lines
   * the way Oxide joins its terminal panel to the rack photograph. Geometry is measured from the
   * DOM, so the line lands on the chip at every width; it is redrawn on resize. */
  function leaders() {
    var grid = $('#heroGrid'), img = $('#heroRender img'), list = $('#heroKeys'), svg = $('#heroLeaders'); if (!grid || !img || !list || !svg) return;
    var pts = [
      { x: 18.5, y: 22, label: 'PUE, design day', value: F('pue.design_day', 3), id: 'pue.design_day' },
      { x: 17, y: 46, label: 'IT load', value: F('power.total_it_mw', 2) + ' MW', id: 'power.total_it_mw' },
      { x: 63, y: 21.5, label: 'GPUs', value: F('compute.gpu_facility'), id: 'compute.gpu_facility' },
      { x: 65, y: 30.5, label: 'NVL72 racks', value: F('compute.racks_facility'), id: 'compute.racks_facility' }
    ];
    list.innerHTML = pts.map(function (p, i) { return '<li style="--i:' + i + '"><span>' + esc(p.label) + '</span><b>' + esc(p.value) + '</b><code>' + esc(p.id) + '</code></li>'; }).join('');
    function draw() {
      var g = grid.getBoundingClientRect(), r = img.getBoundingClientRect(), out = '';
      if (window.innerWidth <= 1100 || !r.width) { svg.innerHTML = ''; return; }
      svg.setAttribute('viewBox', '0 0 ' + g.width + ' ' + g.height);
      /* each key drops from the bottom of its cell into the render, runs along a rail just
       * inside the top edge, and lands on its chip — four lines, four rails, no crossings */
      $$('li', list).forEach(function (li, i) {
        var b = li.getBoundingClientRect(), p = pts[i];
        var x0 = b.left + b.width / 2 - g.left, y0 = b.bottom - g.top, x1 = r.left - g.left + r.width * p.x / 100, y1 = r.top - g.top + r.height * p.y / 100;
        var rail = r.top - g.top - 10 - i * 11; /* rails sit in the 64px gap above the render */
        out += '<path style="--i:' + i + '" d="M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' V' + rail.toFixed(1) + ' H' + x1.toFixed(1) + ' V' + y1.toFixed(1) + '"/><circle style="--i:' + i + '" cx="' + x1.toFixed(1) + '" cy="' + y1.toFixed(1) + '" r="3"/>';
      });
      svg.innerHTML = out;
    }
    if (img.complete) draw(); else img.addEventListener('load', draw);
    if ('ResizeObserver' in window) new ResizeObserver(function () { draw(); }).observe(grid); else window.addEventListener('resize', draw);
  }

  /* Linear-style live vignette: one real input, the engine's own table behind it. Linear
   * interpolation between adjacent bins; the chiller count and free-cooling flag are the bin's. */
  function miniPue() {
    var host = $('#miniPue'), bins = (S && S.bins) || []; if (!host || !bins.length) return;
    var inp = $('input', host), out = $('output', host);
    function at(t) {
      var lo = bins[0], hi = bins[bins.length - 1];
      for (var i = 0; i < bins.length - 1; i++) if (t >= bins[i].ambient_db_c && t <= bins[i + 1].ambient_db_c) { lo = bins[i]; hi = bins[i + 1]; break; }
      var f = hi.ambient_db_c === lo.ambient_db_c ? 0 : (t - lo.ambient_db_c) / (hi.ambient_db_c - lo.ambient_db_c), near = f < .5 ? lo : hi;
      return { pue: lo.pue + (hi.pue - lo.pue) * f, ch: near.chillers_running, fc: near.liquid_free_cooling, h: near.hours };
    }
    function paint() {
      var t = +inp.value, v = at(t); out.textContent = t + ' °C';
      $('[data-mini="pue"]', host).textContent = fmt(v.pue, 3); $('[data-mini="ch"]', host).textContent = fmt(v.ch);
      $('[data-mini="fc"]', host).textContent = v.fc ? 'free cooling' : 'on compressors'; $('[data-mini="h"]', host).textContent = fmt(v.h);
      $$('[data-mini]', host).forEach(function (e) { e.classList.toggle('is-cliff', !v.fc); });
    }
    inp.addEventListener('input', paint); paint();
  }

  function stamp() { $$('[data-engine-stamp]').forEach(function (e) { e.textContent = 'numbers: DC AI engine v' + (S && S.meta && S.meta.version || '—') + ' · ' + (S && S.meta && S.meta.spec_version || ''); }); }

  function init() { mountFigures(); vignettePue(); vignettePlanes(); vignetteCapacity(); vignetteFleet(); leaders(); miniPue(); stamp(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
