/* ltc-plant-strip.js — the one place the plant is edited, on every workbench page.
 *
 * Owner: "minimize inputan, tapi di belakangnya ada otomatis calculation". So a page asks for
 * nothing the plant already knows. The strip shows the plant in one line; "Edit plant" opens
 * three tiers:
 *   Design   ≤ 5 choices that define the plant (configuration, IT load, capture, TCS supply, CDU feed)
 *   Site     climate (illustrative presets or pasted EPW bins), grid factor, renewable, reuse, tariffs
 *   Advanced every other engine input, AUTO until touched; a touched one is badged and resettable
 * Every page module subscribes with LTCPlantStrip.onChange(fn) and redraws from the same result.
 */
(function (root) {
  'use strict';
  var P = root.LTCPlant;
  if (!P) return;
  var state = P.load(), R = P.compute(state), subs = [];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function f(v, d) { return Number(v).toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d || 0 }); }

  var DESIGN = [['itMw', 'IT load', 'MW', 5, 300, 5], ['capturePct', 'Liquid capture', '%', 50, 98, 1], ['tcsSupplyC', 'TCS supply', '°C', 25, 45, 1]];
  var SITE = [['gridEfKgPerKwh', 'Grid emission factor', 'kg/kWh', 0, 1.2, 0.01], ['renewablePct', 'Renewable supply', '%', 0, 100, 1],
              ['heatReusePct', 'Liquid heat reused', '%', 0, 100, 1], ['elecPrice', 'Electricity price', '/kWh', 0, 0.5, 0.005],
              ['waterTariff', 'Water tariff', '/m³', 0, 10, 0.1]];
  /* Advanced: grouped, every key the engine reads that the two tiers above do not set */
  var ADV = [
    ['Liquid path', ['tcsReturnC', 'cduApproachK', 'fwsDeltaK', 'cduUnitKw', 'cduRedundancy', 'tcsHeadM', 'tcsPumpEff', 'fwsHeadM', 'fwsPumpEff', 'cduSkinLossPct', 'trimChillerCop', 'adiabaticEff', 'adiabaticOnC']],
    ['Air path', ['crahUnitKw', 'crahRedundancy', 'airDeltaK', 'sfpKwPerM3s', 'chwSupplyC', 'chwDeltaK', 'chillerUnitKw', 'chillerRedundancy', 'chillerCopRated', 'chwHeadM', 'cwHeadM', 'pumpEff', 'towerApproachK', 'towerFanKwPerMw', 'cyclesOfConc']],
    ['Electrical', ['cordLossPct', 'pduLossPct', 'upsEff', 'distLossPct', 'txEff', 'elecRoomShare', 'auxPctOfIt', 'genUnitKw', 'genRedundancy', 'upsModuleKw', 'txUnitKw', 'txRedundancy']],
    ['Halls & load', ['halls', 'rackKw', 'itUtil', 'racksPerRow', 'rackPitchM', 'rackDepthM', 'coldAisleM', 'hotAisleM', 'endZoneM', 'hallHeightM']],
    ['Design day & transients', ['designDbC', 'designWbC', 'tcsLoopM3PerCdu', 'throttleC', 'chwLoopLPerKw']]
  ];

  function set(patch) {
    state = Object.assign({}, state, patch);
    Object.keys(patch).forEach(function (k) { if (patch[k] === null) delete state[k]; });
    if (patch.tcsSupplyC != null && state.tcsReturnC == null) { /* return follows supply at the default ΔT */ }
    P.save(state);
    R = P.compute(state);
    paint();
    subs.forEach(function (fn) { try { fn(R, state); } catch (e) { console.error('[ltc-plant-strip]', e); } });
  }

  var host = null;
  function line() {
    var T = R.totals, A = R.annual, I = R.input, pr = Object.keys(P.PRESETS).filter(function (k) {
      return P.PRESETS[k].chillerType === I.chillerType && P.PRESETS[k].liquidRejection === I.liquidRejection; })[0];
    return '<span><b>' + f(I.itMw) + ' MW</b> IT</span><span class="sep">/</span>' +
      '<span>' + esc(pr ? P.PRESETS[pr].label : 'custom plant') + '</span><span class="sep">/</span>' +
      '<span>' + esc((P.CLIMATES[I.climate] || { label: 'custom climate' }).label) + '</span><span class="sep">/</span>' +
      '<span>PUE <b>' + T.pue.toFixed(3) + '</b> design · <b>' + T.pueAnnual.toFixed(3) + '</b> annual</span><span class="sep">/</span>' +
      '<span>WUE <b>' + A.wue.toFixed(2) + '</b> L/kWh</span><span class="sep">/</span><span>CUE <b>' + A.cue.toFixed(2) + '</b></span>';
  }
  function field(k, label, unit, min, max, step) {
    var v = R.input[k];
    return '<div class="ltc-field"><label for="ps-' + k + '">' + esc(label) + '</label><output id="ps-' + k + '-o">' + esc(v + ' ' + unit) + '</output>' +
      '<input type="range" id="ps-' + k + '" data-k="' + k + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + v + '"></div>';
  }
  function advRow(k) {
    var d = P.DEFAULTS[k], cur = R.input[k], over = Object.prototype.hasOwnProperty.call(state, k);
    if (typeof d !== 'number') return '';
    return '<label class="ltc-adv-row' + (over ? ' is-over' : '') + '"><span>' + esc(k) + '</span>' +
      '<input type="number" step="any" data-adv="' + k + '" value="' + (over ? cur : '') + '" placeholder="' + cur + '" aria-label="' + esc(k) + '">' +
      (over ? '<button type="button" class="ltc-adv-reset" data-reset="' + k + '" aria-label="Reset ' + esc(k) + ' to auto">auto</button>' : '<i>auto</i>') + '</label>';
  }
  function panel() {
    var I = R.input;
    return '<div class="ltc-ps-panel" id="ltcPsPanel" hidden>' +
      '<h3 class="ltc-script-h">Design</h3><div class="ltc-seg ltc-ps-presets" role="group" aria-label="Plant configuration">' +
      Object.keys(P.PRESETS).map(function (k) { return '<button type="button" data-preset="' + k + '">' + esc(P.PRESETS[k].label) + '</button>'; }).join('') + '</div>' +
      '<div class="ltc-plant-fields">' + DESIGN.map(function (c) { return field.apply(null, c); }).join('') +
      '<div class="ltc-field"><label>CDU feed</label><div class="ltc-seg" role="group" aria-label="CDU feed"><button type="button" data-feed="single">Single A/B</button><button type="button" data-feed="dual">Dual (ATS)</button></div></div></div>' +
      '<h3 class="ltc-script-h">Site</h3><div class="ltc-plant-fields"><div class="ltc-field"><label for="ps-climate">Climate</label><span></span>' +
      '<select class="ltc-select" id="ps-climate" data-climate>' + Object.keys(P.CLIMATES).map(function (k) { return '<option value="' + k + '">' + esc(P.CLIMATES[k].label) + '</option>'; }).join('') +
      '<option value="custom">Custom — paste EPW bins</option></select></div>' + SITE.map(function (c) { return field.apply(null, c); }).join('') + '</div>' +
      '<div class="ltc-ps-bins" hidden><label for="ps-bins">Dry bulb, wet bulb, hours — one bin per line (build them from the site’s EPW file)</label><textarea id="ps-bins" rows="5" class="ltc-select"></textarea><button type="button" class="ltc-btn" data-binsave>Use these bins</button><span class="ltc-ps-binmsg"></span></div>' +
      '<details class="ltc-ps-adv"><summary>Advanced — ' + ADV.reduce(function (n, g) { return n + g[1].length; }, 0) + ' engine inputs, auto unless you change one</summary>' +
      ADV.map(function (g) { return '<h4>' + esc(g[0]) + '</h4><div class="ltc-adv-grid">' + g[1].map(advRow).join('') + '</div>'; }).join('') +
      '<button type="button" class="ltc-btn" data-resetall>Reset every input to auto</button></details></div>';
  }
  function paint() {
    if (!host) return;
    host.querySelector('.ltc-ps-line').innerHTML = line();
    var pnl = host.querySelector('.ltc-ps-panel');
    if (!pnl || pnl.hidden) return;
    var I = R.input;
    [].forEach.call(pnl.querySelectorAll('[data-preset]'), function (b) { var p = P.PRESETS[b.getAttribute('data-preset')]; b.setAttribute('aria-pressed', String(p.chillerType === I.chillerType && p.liquidRejection === I.liquidRejection)); });
    [].forEach.call(pnl.querySelectorAll('[data-feed]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-feed') === I.cduFeed)); });
    DESIGN.concat(SITE).forEach(function (c) {
      var inp = document.getElementById('ps-' + c[0]), out = document.getElementById('ps-' + c[0] + '-o');
      if (inp && Number(inp.value) !== I[c[0]] && document.activeElement !== inp) inp.value = I[c[0]];
      if (out) out.textContent = I[c[0]] + ' ' + c[2];
    });
    var sel = document.getElementById('ps-climate');
    if (sel) sel.value = P.CLIMATES[I.climate] ? I.climate : 'custom';
    host.querySelector('.ltc-ps-bins').hidden = !!P.CLIMATES[I.climate];
  }
  function mount() {
    var work = document.querySelector('.ltc-work');
    if (!work || document.getElementById('ltcPlantStrip')) return;
    host = document.createElement('section');
    host.id = 'ltcPlantStrip';
    host.className = 'ltc-ps';
    host.setAttribute('aria-label', 'Plant');
    host.innerHTML = '<div class="ltc-ps-bar"><p class="ltc-ps-line" aria-live="polite"></p>' +
      '<button type="button" class="ltc-btn" data-edit aria-expanded="false" aria-controls="ltcPsPanel">Edit plant</button></div>' + panel();
    var head = work.querySelector('.ltc-head');   // inside the head: it inherits the page gutter
    if (head) head.appendChild(host); else work.insertBefore(host, work.firstChild);
    host.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('[data-edit]')) {
        var pn = host.querySelector('.ltc-ps-panel'), b = t.closest('[data-edit]');
        pn.hidden = !pn.hidden; b.setAttribute('aria-expanded', String(!pn.hidden)); paint(); return;
      }
      var pr = t.closest('[data-preset]'); if (pr) { var k = pr.getAttribute('data-preset'); set(Object.assign({ preset: k }, P.PRESETS[k])); return; }
      var fd = t.closest('[data-feed]'); if (fd) { set({ cduFeed: fd.getAttribute('data-feed') }); return; }
      var rs = t.closest('[data-reset]'); if (rs) { var o = {}; o[rs.getAttribute('data-reset')] = null; set(o); rebuild(); return; }
      if (t.closest('[data-resetall]')) { state = {}; set({}); rebuild(); return; }
      if (t.closest('[data-binsave]')) {
        var bins = P.parseBins(document.getElementById('ps-bins').value), hrs = bins.reduce(function (n, b) { return n + b[2]; }, 0);
        var msg = host.querySelector('.ltc-ps-binmsg');
        if (!bins.length) { msg.textContent = 'No valid lines (need dry bulb ≥ wet bulb, hours > 0).'; return; }
        msg.textContent = bins.length + ' bins, ' + f(hrs) + ' h' + (Math.abs(hrs - 8760) > 1 ? ' — not 8,760 h; annual figures scale to these hours' : '');
        var dmax = bins.reduce(function (m, b) { return b[0] > m[0] ? b : m; }, bins[0]);
        set({ climate: 'custom', climateBins: bins, designDbC: dmax[0], designWbC: dmax[1] });
      }
    });
    host.addEventListener('input', function (e) {
      var k = e.target.getAttribute('data-k');
      if (k) { var o = {}; o[k] = Number(e.target.value); set(o); }
    });
    host.addEventListener('change', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-climate')) {
        if (t.value === 'custom') { host.querySelector('.ltc-ps-bins').hidden = false; return; }
        set({ climate: t.value, climateBins: null, designDbC: null, designWbC: null });
      }
      var a = t.getAttribute('data-adv');
      if (a) { var o = {}; o[a] = t.value === '' ? null : Number(t.value); set(o); rebuild(); }
    });
    root.addEventListener('storage', function (e) { if (e.key === P.KEY) { state = P.load(); R = P.compute(state); paint(); subs.forEach(function (fn) { fn(R, state); }); } });
    paint();
  }
  function rebuild() {   // advanced rows re-render to show the new auto / override badges
    var adv = host && host.querySelector('.ltc-ps-adv');
    if (!adv) return;
    var open = adv.open, tmp = document.createElement('div');
    tmp.innerHTML = panel();
    adv.replaceWith(tmp.querySelector('.ltc-ps-adv'));
    host.querySelector('.ltc-ps-adv').open = open;
  }

  /* bind(id, fn, why): an input the plant can answer. It shows the plant's value with an
   * "auto" badge and follows the plant until the reader types; then it keeps the reader's value,
   * badged "yours", with a one-click return to auto. `why` is the tooltip: where the value comes from. */
  var binds = [];
  function bind(id, fn, why, digits) {
    var el = document.getElementById(id);
    if (!el) return;
    var lab = document.querySelector('label[for="' + id + '"]');
    var badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'ltc-autob';
    badge.title = why;
    (lab || el).appendChild ? (lab ? lab.appendChild(badge) : el.parentNode.appendChild(badge)) : null;
    var b = { el: el, fn: fn, user: false, badge: badge, d: digits == null ? 1 : digits };
    function show() { badge.textContent = b.user ? 'yours ↺' : 'auto'; badge.setAttribute('data-user', String(b.user));
      badge.setAttribute('aria-label', b.user ? 'Return ' + id + ' to the plant value' : 'Value from the plant: ' + why); }
    b.apply = function () {
      if (b.user) return;
      var v = fn(R);
      if (v == null || !isFinite(v)) return;
      var m = Math.pow(10, b.d); el.value = Math.round(v * m) / m;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    el.addEventListener('input', function (e) { if (e.isTrusted) { b.user = true; show(); } });
    badge.addEventListener('click', function (e) { e.preventDefault(); b.user = false; show(); b.apply(); });
    show(); b.apply();
    binds.push(b);
  }
  subs.push(function () { binds.forEach(function (b) { b.apply(); }); });

  root.LTCPlantStrip = {
    bind: bind,
    get: function () { return { result: R, state: state }; },
    set: set,
    onChange: function (fn) { subs.push(fn); return function () { subs = subs.filter(function (x) { return x !== fn; }); }; },
    mount: mount
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})(window);
