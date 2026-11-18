/* air-section.js — RZAirSection: the air path of one data-hall row, drawn as a schematic section
   (PRD-CONV-LIVING-PLANT §5.2, §9). CRAH → cold aisle → rack → contained hot aisle → ceiling void → CRAH.

   Every moving or coloured thing is bound to a value the page already shows; nothing is decorative:
     streamline speed   ∝ row airflow / design airflow      (RZConvVfx.dashSeconds — zero airflow, no motion)
     fan wheel speed    ∝ CRAH fan %                        (RZConvVfx.rotorSeconds — below 5 %, still)
     cold-side colour   = supply / rack-inlet temperature   on the RZConvVfx thermal ramp
     hot-side colour    = hot-aisle / return temperature    on the same ramp
     rack tint          ∝ row heat / design row heat
     CHW stubs          = CHWS / CHWR temperature, moving only while the valve is open and the fan runs

   It is a physical illustration, not a block diagram: the geometry is one fixed cut, so it is authored here and
   not routed by RZDiagram. model() is pure and Node-tested (tools/test-conv-air-section.mjs); render() needs a DOM. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RZAirSection = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  /* Presentation range of the temperature ramp for air, °C: chosen so the adopted supply air reads
     blue, an inlet near the 27 °C recommended maximum turns amber and a contained hot aisle reads orange to red.
     A display choice, declared on the page; the chilled-water stubs use their own 16–30 °C range. */
  var AIR_LO_C = 24, AIR_HI_C = 40;
  var CHW_LO_C = 16, CHW_HI_C = 30;

  function isNum(n) { return typeof n === 'number' && isFinite(n); }
  function vfx() { return root.RZConvVfx || (typeof require === 'function' ? require('./vfx.js') : null); }

  /* Pure: values in, drawing instructions out. */
  function model(d) {
    var V = vfx(); d = d || {};
    var running = !!d.running && isNum(d.airflowM3s) && d.airflowM3s > 0;
    var ratio = running && isNum(d.designAirflowM3s) && d.designAirflowM3s > 0 ? d.airflowM3s / d.designAirflowM3s : 0;
    var airSec = running ? V.dashSeconds(ratio) : null;
    var chwOn = running && isNum(d.valvePct) && d.valvePct > 0;
    var heat = isNum(d.heatKw) && isNum(d.designHeatKw) && d.designHeatKw > 0 ? d.heatKw / d.designHeatKw : null;
    return {
      running: running,
      airSeconds: airSec,                                   /* null = no motion */
      rotorSeconds: running ? V.rotorSeconds(d.fanPct) : null,
      chwSeconds: chwOn ? V.dashSeconds(d.valvePct / 100) : null,
      cold: V.thermal(d.inletC, AIR_LO_C, AIR_HI_C),
      supply: V.thermal(d.supplyC, AIR_LO_C, AIR_HI_C),
      hot: V.thermal(d.hotC, AIR_LO_C, AIR_HI_C),
      ret: V.thermal(d.returnC, AIR_LO_C, AIR_HI_C),
      chws: V.thermal(d.chwsC, CHW_LO_C, CHW_HI_C),
      chwr: V.thermal(d.chwrC, CHW_LO_C, CHW_HI_C),
      heatRatio: heat,
      rackTint: heat == null ? null : V.thermal(heat, 0, 1.2),
      state: !running ? 'stopped' : (isNum(d.inletC) && isNum(d.alarmC) && d.inletC > d.alarmC) ? 'alarm'
        : (isNum(d.inletC) && isNum(d.warnC) && d.inletC > d.warnC) ? 'warning' : 'running'
    };
  }

  /* ---- drawing (one fixed cut, viewBox 752 × 260) ---------------------------------------------------- */
  var SUPPLY = ['M178 208 H316 C338 208 338 196 350 196', 'M178 198 H306 C336 198 334 150 350 150', 'M178 188 H296 C334 188 330 104 350 104'];
  var SUPPLY_S = ['M744 208 H634 C612 208 612 196 600 196', 'M744 198 H644 C614 198 616 150 600 150', 'M744 188 H654 C616 188 620 104 600 104'];
  var THROUGH = ['M350 196 H410', 'M350 150 H410', 'M350 104 H410', 'M600 196 H540', 'M600 150 H540', 'M600 104 H540'];
  var HOT = ['M410 196 C424 196 424 180 424 160 V49 H156 V70', 'M410 150 C419 150 419 140 419 120 V44 H146 V70', 'M410 104 C414 104 414 96 414 90 V39 H136 V70',
    'M540 196 C526 196 526 180 526 160 V34 H126 V70', 'M540 150 C531 150 531 140 531 120 V29 H116 V70', 'M540 104 C536 104 536 96 536 90 V24 H106 V70'];

  var seq = 0;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function paths(list, cls) { return list.map(function (d) { return '<path class="as-line ' + cls + '" d="' + d + '"/><path class="as-flow ' + cls + '" d="' + d + '"/>'; }).join(''); }
  function fx(n, dp) { return isNum(n) ? n.toFixed(dp) : '—'; }
  /* A reading: label + value, the value element carries the registry key when the number is an engine plane. */
  function reading(x, y, anchor, label, key, val, unit, basis) {
    return '<text class="as-lbl" x="' + x + '" y="' + y + '" text-anchor="' + anchor + '">' + esc(label) + ' <tspan class="as-val" data-as="' + key + '"'
      + (basis ? ' data-basis-param="' + basis + '" tabindex="0" role="button"' : '') + '>' + esc(val) + '</tspan>' + (unit ? ' ' + esc(unit) : '') + '</text>';
  }

  function render(host, d) {
    if (!host) return null;
    var m = model(d), id = 'as' + (++seq);
    var blades = [0, 90, 180, 270].map(function (a) { return '<path d="M136 186 q6 -10 0 -16 q-3 8 0 16" transform="rotate(' + a + ' 136 186)"/>'; }).join('');
    host.innerHTML = '<div class="as-scroll"><svg class="as-svg" viewBox="0 0 752 260" role="img" aria-label="' + esc('Air path, section through row ' + d.row
      + ': supply air ' + fx(d.supplyC, 1) + ' °C, rack inlet ' + fx(d.inletC, 1) + ' °C, hot aisle ' + fx(d.hotC, 1) + ' °C, return air ' + fx(d.returnC, 1) + ' °C') + '">'
      + '<defs><linearGradient id="' + id + 'n" gradientUnits="userSpaceOnUse" x1="350" x2="410" y1="0" y2="0"><stop offset="0" class="as-g-cold"/><stop offset="1" class="as-g-hot"/></linearGradient>'
      + '<linearGradient id="' + id + 's" gradientUnits="userSpaceOnUse" x1="600" x2="540" y1="0" y2="0"><stop offset="0" class="as-g-cold"/><stop offset="1" class="as-g-hot"/></linearGradient>'
      + '<marker id="' + id + 'a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill="context-stroke"/></marker></defs>'
      /* building: slab, suspended ceiling with the containment opening, floor */
      + '<path class="as-wall" d="M8 20 H744 M8 220 H744"/><path class="as-ceil" d="M8 56 H410 M540 56 H744"/>'
      + '<path class="as-wall" d="M410 80 V56 M540 80 V56"/>'
      /* CRAH: casing, coil, fan */
      + '<rect class="as-box" x="96" y="70" width="80" height="150"/>'
      + '<path class="as-coil" d="M104 112 L112 84 L120 112 L128 84 L136 112 L144 84 L152 112 L160 84 L168 112"/>'
      + '<circle class="as-fan-ring" cx="136" cy="186" r="18"/><g class="as-fan">' + blades + '</g>'
      /* chilled water in and out of the coil */
      + '<path class="as-line as-chws" d="M8 92 H104" marker-end="url(#' + id + 'a)"/><path class="as-flow as-chws" d="M8 92 H104"/>'
      + '<path class="as-line as-chwr" d="M104 108 H8" marker-end="url(#' + id + 'a)"/><path class="as-flow as-chwr" d="M104 108 H8"/>'
      /* racks, tinted by row heat */
      + '<rect class="as-rack" x="350" y="80" width="60" height="140"/><rect class="as-rack" x="540" y="80" width="60" height="140"/>'
      + '<path class="as-rack-u" d="M350 115 H410 M350 150 H410 M350 185 H410 M540 115 H600 M540 150 H600 M540 185 H600"/>'
      /* air */
      + '<g marker-end="url(#' + id + 'a)">' + paths(SUPPLY, 'as-cold') + paths(SUPPLY_S, 'as-cold') + '</g>'
      + '<g class="as-through-n" stroke="url(#' + id + 'n)">' + paths(THROUGH.slice(0, 3), 'as-thr') + '</g><g class="as-through-s" stroke="url(#' + id + 's)">' + paths(THROUGH.slice(3), 'as-thr') + '</g>'
      + '<g marker-end="url(#' + id + 'a)">' + paths(HOT, 'as-hot') + '</g>'
      /* names */
      + '<text class="as-name" x="136" y="130" text-anchor="middle">CRAH <tspan data-as="state"></tspan></text>'
      + reading(136, 144, 'middle', 'fan', 'fan', '', '%') + reading(136, 158, 'middle', 'valve', 'valve', '', '%')
      + reading(8, 86, 'start', 'CHWS', 'chws', '', '°C', 'cooling.chws_c') + reading(8, 124, 'start', 'CHWR', 'chwr', '', '°C', 'cooling.chwr_c')
      + reading(186, 74, 'start', 'Return air', 'return', '', '°C')
      + '<text class="as-name" x="296" y="122" text-anchor="middle">Rack inlet</text><text class="as-lbl" x="296" y="138" text-anchor="middle"><tspan class="as-val" data-as="inlet"></tspan> °C</text>'
      + '<text class="as-name" x="475" y="134" text-anchor="middle">Hot aisle</text><text class="as-lbl" x="475" y="150" text-anchor="middle"><tspan class="as-val" data-as="hot"></tspan> °C</text>'
      + '<text class="as-lbl" x="475" y="166" text-anchor="middle">contained</text>'
      + reading(178, 238, 'start', 'Supply air', 'supply', '', '°C', 'cooling.crah_supply_air_c') + reading(178, 252, 'start', 'airflow', 'airflow', '', 'm³/s')
      + '<text class="as-name" x="475" y="238" text-anchor="middle">Row <tspan data-as="row"></tspan> heat <tspan class="as-val" data-as="heat"></tspan> kW</text>'
      + reading(475, 252, 'middle', 'air ΔT', 'dt', '', 'K')
      + '<text class="as-lbl" x="672" y="238" text-anchor="middle">from the south rail</text>'
      + '</svg></div>';
    update(host, d, m);
    return m;
  }

  function update(host, d, m) {
    var svg = host && host.querySelector('.as-svg'); if (!svg) return null;
    m = m || model(d);
    var set = function (k, v) { var el = svg.querySelector('[data-as="' + k + '"]'); if (el && el.textContent !== v) el.textContent = v; };
    set('state', m.running ? '· RUN' : '· STBY'); set('fan', fx(m.running ? d.fanPct : 0, 0)); set('valve', fx(m.running ? d.valvePct : 0, 0));
    set('chws', fx(d.chwsC, 1)); set('chwr', fx(d.chwrC, 1)); set('return', fx(d.returnC, 1)); set('inlet', fx(d.inletC, 1)); set('hot', fx(d.hotC, 1));
    set('supply', fx(d.supplyC, 1)); set('airflow', fx(d.airflowM3s, 2)); set('row', String(d.row == null ? '' : d.row)); set('heat', fx(d.heatKw, 0)); set('dt', fx(d.dtK, 1));
    var st = svg.style, P = function (k, v) { if (v == null) st.removeProperty(k); else st.setProperty(k, v); };
    P('--as-cold', m.cold); P('--as-supply', m.supply); P('--as-hot', m.hot); P('--as-ret', m.ret); P('--as-chws', m.chws); P('--as-chwr', m.chwr); P('--as-rack', m.rackTint);
    P('--as-air-dur', m.airSeconds == null ? null : m.airSeconds + 's'); P('--as-fan-dur', m.rotorSeconds == null ? null : m.rotorSeconds + 's'); P('--as-chw-dur', m.chwSeconds == null ? null : m.chwSeconds + 's');
    var A = function (k, v) { if (v) svg.setAttribute(k, v === true ? '' : v); else svg.removeAttribute(k); };
    A('data-air', m.airSeconds != null); A('data-fan', m.rotorSeconds != null); A('data-chw', m.chwSeconds != null); A('data-vstate', m.state);
    return m;
  }

  return { model: model, render: render, update: update, AIR_RANGE_C: [AIR_LO_C, AIR_HI_C], CHW_RANGE_C: [CHW_LO_C, CHW_HI_C] };
});
