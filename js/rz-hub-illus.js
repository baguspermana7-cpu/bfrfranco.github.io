/* rz-hub-illus.js — one small live panel above each catalogue group on the DC Solutions hub
 * (PLAN H3, 2026-10-16), the way Oxide heads each feature with a running instrument.
 *
 * Each panel is an SVG drawn here and moved by a per-panel tick while it is on screen. A number
 * printed in a panel is the DC AI engine's (DCAI_CALC.snapshot) or a label; a panel with no
 * published quantity behind it prints none and says it is a shape. prefers-reduced-motion: the
 * final state, no ticking. ES5, no deps beyond rz-eng-symbols.js (optional).
 */
(function (root) {
  'use strict';
  var S = root.DCAI_CALC && root.DCAI_CALC.snapshot, LIB = root.RZEngSymbols;
  var REDUCE = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function get(p) { var o = S; if (!o) return null; p = p.split('.'); for (var i = 0; i < p.length; i++) { if (o == null) return null; o = o[p[i]]; } return typeof o === 'number' ? o : null; }
  function n(v, d) { return typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 }) : '—'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sym(kind, x, y, s) { var m = LIB && LIB.MARKUP[kind]; if (!m) return ''; var k = s / 48; return '<g transform="translate(' + x + ',' + y + ') scale(' + k + ')" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + m + '</g>'; }
  var W = 520, H = 128;

  /* 1 · cockpits: the ATS sequence on the engine's standby pool — two sources, one transfer, one bus */
  function cockpits() {
    var gk = get('equipment.generator_unit_kw'), gi = get('equipment.gensets_installed'), fa = get('site.fuel_autonomy_h');
    var cb = function (k, y) { return '<g class="tgi-cb tgi-cb' + k + '" transform="translate(150,' + y + ')"><path d="M0 0 H24"/><circle r="2.2"/><circle cx="24" cy="0" r="2.2"/></g>'; };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="tgi-svg" role="img" aria-label="Automatic transfer: utility to standby generation and back">' +
      '<g class="tgi-util" style="color:var(--t2)">' + sym('utility', 18, 6, 34) + '</g><text x="35" y="52" class="tgi-l" text-anchor="middle">UTILITY</text>' +
      '<g class="tgi-gen" style="color:var(--t2)">' + sym('genset', 18, 72, 34) + '</g><text x="35" y="118" class="tgi-l" text-anchor="middle">GENSET</text>' +
      '<path class="tgi-wire tgi-w1" d="M58 23 H150"/><path class="tgi-wire" d="M174 23 H200 V50"/>' + cb(1, 23) +
      '<path class="tgi-wire" d="M58 89 H150 M174 89 H200 V50"/>' + cb(2, 89) +
      '<text x="162" y="12" class="tgi-l" text-anchor="middle">N</text><text x="162" y="108" class="tgi-l" text-anchor="middle">E</text>' +
      '<path class="tgi-wire" d="M200 50 H240"/><circle cx="200" cy="50" r="2.2" class="tgi-node-dot"/>' +
      '<rect x="240" y="26" width="6" height="48" class="tgi-bus"/><text x="243" y="18" class="tgi-l" text-anchor="middle">BUS</text>' +
      '<path class="tgi-wire tgi-load" d="M246 50 H300"/>' + sym('rack', 300, 30, 40) + '<text x="320" y="92" class="tgi-l" text-anchor="middle">LOAD</text>' +
      '<g class="tgi-flow"><path class="tgi-pulse tgi-p1" d="M58 23 H200 V50 H240"/><path class="tgi-pulse tgi-p2" d="M58 89 H200 V50 H240" style="display:none"/><path class="tgi-pulse tgi-pL" d="M246 50 H300"/></g>' +
      '<text x="512" y="28" class="tgi-s tgi-st" text-anchor="end">UTILITY · NORMAL</text>' +
      '<text x="512" y="118" class="tgi-l" text-anchor="end">' + n(gi) + ' × ' + n(gk) + ' kW · ' + n(fa) + ' h fuel</text>' +
      '<text x="512" y="76" class="tgi-l tgi-t" text-anchor="end"></text></svg>';
    return { svg: svg, tick: function (host, t) {
      var ph = (t / 1000) % 14, q = function (s) { return host.querySelector(s); }, st = q('.tgi-st'), tt = q('.tgi-t');
      var state = ph < 5 ? 0 : ph < 6.5 ? 1 : ph < 11 ? 2 : 3, onU = state === 0 || state === 3, onG = state === 2;
      host.setAttribute('data-ats', state);
      st.textContent = ['UTILITY · NORMAL', 'UTILITY LOST · GENSET STARTING', 'ON GENSET · ATS CLOSED', 'UTILITY BACK · RETRANSFER'][state];
      tt.textContent = state === 1 ? 'start ' + Math.max(0, (6.5 - ph)).toFixed(1) + ' s' : state === 2 ? 'fuel ' + n(fa) + ' h' : '';
      q('.tgi-cb1 path').setAttribute('d', onU ? 'M0 0 H24' : 'M0 0 L22 -9');
      q('.tgi-cb2 path').setAttribute('d', onG ? 'M0 0 H24' : 'M0 0 L22 -9');
      q('.tgi-p1').style.display = onU ? '' : 'none'; q('.tgi-p2').style.display = onG ? '' : 'none';
      q('.tgi-w1').classList.toggle('is-lost', state === 1 || state === 2); q('.tgi-gen').classList.toggle('is-on', onG);
    } };
  }
  /* 2 · cost and planning: the commissioning levels as gates on a line */
  function cost() {
    var L = ['L0 design review', 'L1 factory witness', 'L2 site acceptance', 'L3 start-up', 'L4 functional performance', 'L5 integrated systems', 'L6 operational'];
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="tgi-svg" role="img" aria-label="Commissioning gates L0 to L6"><path d="M30 64 H490" class="tgi-wire"/>';
    L.forEach(function (l, i) { var x = 30 + i * (460 / 6); svg += '<g class="tgi-gate" data-i="' + i + '"><path d="M' + x + ' 54 l10 10 -10 10 -10 -10z" class="tgi-gatebox"/><text x="' + x + '" y="' + (i % 2 ? 100 : 40) + '" class="tgi-l" text-anchor="middle">' + esc(l.split(' ')[0]) + '</text></g>'; });
    svg += '<circle class="tgi-cur" cx="30" cy="64" r="4"/><text x="512" y="28" class="tgi-s tgi-st" text-anchor="end">L0 DESIGN REVIEW</text><text x="512" y="118" class="tgi-l" text-anchor="end">gates, not a schedule — run the Cx calculator for the dates</text></svg>';
    return { svg: svg, tick: function (host, t) {
      var ph = (t / 1000) % 10.5, i = Math.min(6, Math.floor(ph / 1.5)), f = Math.min(1, (ph - i * 1.5) / 1.1), x = 30 + (i + f) * (460 / 6);
      host.querySelector('.tgi-cur').setAttribute('cx', Math.min(490, x)); host.querySelector('.tgi-st').textContent = L[Math.min(6, Math.round(Math.min(6, i + f)))].toUpperCase();
      Array.prototype.forEach.call(host.querySelectorAll('.tgi-gate'), function (g, k) { g.classList.toggle('is-done', k < i + f - 0.5); });
    } };
  }
  /* 3 · strategy: the shape of three ownership models — stated as a shape */
  function strategy() {
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="tgi-svg" role="img" aria-label="Build, colocation and cloud: cumulative cost shapes over time"><path d="M40 108 H480 M40 108 V20" class="tgi-wire"/>' +
      '<path class="tgi-line tgi-c1" d="M40 60 C 60 58, 70 58, 90 56 L 480 44"/><path class="tgi-line tgi-c2" d="M40 108 L 480 52"/><path class="tgi-line tgi-c3" d="M40 104 C 200 96, 330 76, 480 24"/>' +
      '<text x="486" y="47" class="tgi-l">build</text><text x="486" y="56" class="tgi-l" dy="9">colo</text><text x="486" y="24" class="tgi-l">cloud</text>' +
      '<text x="40" y="120" class="tgi-l">2025</text><text x="470" y="120" class="tgi-l" text-anchor="end">2030</text>' +
      '<text x="300" y="30" class="tgi-l" text-anchor="middle">cumulative cost · a shape, not a result</text><circle class="tgi-cur" cx="40" cy="60" r="3.5"/></svg>';
    return { svg: svg, tick: function (host, t) {
      var ls = host.querySelectorAll('.tgi-line'), ph = (t / 1000) % 9, u = Math.min(1, ph / 6);
      Array.prototype.forEach.call(ls, function (l) { var len = l.getTotalLength(); l.style.strokeDasharray = len; l.style.strokeDashoffset = len * (1 - u); });
      var l3 = ls[2], pt = l3.getPointAtLength(l3.getTotalLength() * u); host.querySelector('.tgi-cur').setAttribute('cx', pt.x); host.querySelector('.tgi-cur').setAttribute('cy', pt.y);
    } };
  }
  /* 4 · engineering: PUE across the engine's weather bins, a cursor sweeping it */
  function engineering() {
    var bins = (S && S.bins) || []; if (!bins.length) return null;
    var lo = 1.10, hi = 1.30, x0 = 44, x1 = 290, xs = function (i) { return x0 + i * (x1 - x0) / (bins.length - 1); }, ys = function (v) { return 110 - (v - lo) / (hi - lo) * 84; };
    var d = ''; bins.forEach(function (b, i) { d += (i ? ' H' + xs(i).toFixed(1) + ' V' + ys(b.pue).toFixed(1) : 'M' + xs(i) + ' ' + ys(b.pue).toFixed(1)); }); d += ' H' + (x1 + 20);
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="tgi-svg" role="img" aria-label="PUE by ambient bin">';
    [1.12, 1.20, 1.25].forEach(function (g) { svg += '<path d="M' + x0 + ' ' + ys(g).toFixed(1) + ' H' + (x1 + 20) + '" class="tgi-grid"/><text x="' + (x0 - 4) + '" y="' + (ys(g) + 3).toFixed(1) + '" class="tgi-l" text-anchor="end">' + g.toFixed(2) + '</text>'; });
    svg += '<path d="' + d + '" class="tgi-line is-on"/>';
    bins.forEach(function (b, i) { svg += '<text x="' + xs(i) + '" y="124" class="tgi-l" text-anchor="middle">' + b.ambient_db_c + '°</text>'; });
    svg += '<line class="tgi-cursor" x1="' + x0 + '" x2="' + x0 + '" y1="18" y2="112"/><circle class="tgi-cur" r="3.5"/>' +
      '<text x="512" y="28" class="tgi-l" text-anchor="end">PUE · bins[i].pue</text><text x="512" y="56" class="tgi-s tgi-st" text-anchor="end">—</text><text x="512" y="80" class="tgi-l tgi-t" text-anchor="end"></text></svg>';
    return { svg: svg, tick: function (host, t) {
      var ph = ((t / 1000) % 10) / 10, i = Math.min(bins.length - 1, Math.floor(ph * bins.length)), b = bins[i], x = xs(i) + (ph * bins.length - i) * ((x1 - x0) / (bins.length - 1));
      var c = host.querySelector('.tgi-cursor'); c.setAttribute('x1', x); c.setAttribute('x2', x);
      var cur = host.querySelector('.tgi-cur'); cur.setAttribute('cx', x); cur.setAttribute('cy', ys(b.pue)); cur.classList.toggle('is-cliff', !b.liquid_free_cooling);
      host.querySelector('.tgi-st').textContent = n(b.pue, 3) + ' at ' + b.ambient_db_c + ' °C'; host.querySelector('.tgi-t').textContent = n(b.chillers_running) + ' chillers · ' + (b.liquid_free_cooling ? 'free cooling' : 'on compressors');
      host.classList.toggle('is-cliff', !b.liquid_free_cooling);
    } };
  }
  /* 5 · grid monitors: the Java–Bali backbone as a chain of regions, power pulsing along it */
  function grid() {
    var R = ['Banten', 'Jakarta', 'Jabar', 'Jateng', 'DIY', 'Jatim', 'Bali'];
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="tgi-svg" role="img" aria-label="Java–Bali 500 kV backbone, region by region"><path class="tgi-wire" d="M40 64 H480"/>';
    R.forEach(function (r, i) { var x = 40 + i * (440 / 6); svg += '<g class="tgi-node"><circle cx="' + x + '" cy="64" r="6" class="tgi-gatebox"/><text x="' + x + '" y="' + (i % 2 ? 98 : 44) + '" class="tgi-l" text-anchor="middle">' + r + '</text></g>'; });
    svg += '<path class="tgi-pulse tgi-p1" d="M40 64 H480"/><text x="512" y="118" class="tgi-l" text-anchor="end">500 kV backbone · live monitors for Java–Bali and Sumatra</text></svg>';
    return { svg: svg, tick: function (host, t) { var ph = (t / 1000) % 7, i = Math.floor(ph); Array.prototype.forEach.call(host.querySelectorAll('.tgi-node'), function (g, k) { g.classList.toggle('is-done', k === i); }); } };
  }
  /* 6 · labs: electricity in, heat out — the balance the LTC plant model holds */
  function labs() {
    var it = get('power.total_it_kwe'), loss = get('design.electrical.ups_dist_loss_kwe'), aux = get('design.electrical.aux_kwe'), liq = get('heat.liquid_kwth'), air = get('heat.air_kwth');
    if (it == null || loss == null || aux == null || liq == null || air == null) return null;
    /* the engine's air heat carries the UPS, distribution and aux losses too (dcai-engine airHeat_kwth), so the
     * electricity that becomes heat is IT + those losses — the two sides then close to the kilowatt */
    var ein = it + loss + aux, tot = liq + air, wl = 300 * liq / tot, wa = 300 - wl;
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="tgi-svg" role="img" aria-label="Electricity in, heat out">' +
      '<text x="20" y="40" class="tgi-l">ELECTRICITY IN</text><rect x="20" y="48" width="140" height="22" class="tgi-bar tgi-bin"/><text x="26" y="63" class="tgi-s">' + n(ein / 1000, 2) + ' MW</text>' +
      '<text x="20" y="86" class="tgi-l">IT ' + n(it / 1000, 2) + ' + LOSSES ' + n((loss + aux) / 1000, 2) + '</text>' +
      '<path class="tgi-wire" d="M160 59 H200"/><path class="tgi-pulse tgi-p1" d="M160 59 H200"/>' +
      '<text x="200" y="40" class="tgi-l">HEAT OUT · ' + n(tot / 1000, 2) + ' MW</text><text x="200" y="86" class="tgi-l">LIQUID ' + n(liq / 1000, 1) + ' + AIR ' + n(air / 1000, 1) + '</text>' +
      '<rect x="200" y="48" width="' + wl.toFixed(1) + '" height="22" class="tgi-bar tgi-liq"/><rect x="' + (200 + wl).toFixed(1) + '" y="48" width="' + wa.toFixed(1) + '" height="22" class="tgi-bar tgi-air"/>' +
      '<text x="206" y="63" class="tgi-s">liquid ' + n(100 * liq / tot) + ' %</text><text x="' + (206 + wl).toFixed(1) + '" y="63" class="tgi-s">air</text>' +
      '<text x="20" y="116" class="tgi-l">air carries the UPS, distribution and aux losses · the LTC labs move the plant</text></svg>';
    return { svg: svg, tick: function (host, t) { var u = Math.min(1, ((t / 1000) % 6) / 1.2); host.querySelector('.tgi-liq').style.transform = 'scaleX(' + u + ')'; host.querySelector('.tgi-air').style.transform = 'scaleX(' + u + ')'; } };
  }
  /* 7 · knowledge: the titles stepping */
  /* 7 · knowledge: the shelf — one spine per title across the width; the one being read stands
   * out of the row and its title prints large on the right */
  function knowledge(group) {
    var titles = Array.prototype.map.call(group.querySelectorAll('.tool .nm'), function (e) { return e.textContent; }), n = titles.length;
    var x0 = 24, x1 = 240, pitch = (x1 - x0) / n, svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="tgi-svg" role="img" aria-label="The knowledge shelf: ' + n + ' titles">';
    svg += '<path d="M' + (x0 - 8) + ' 108 H' + (x1 + 4) + '" class="tgi-wire"/>';
    titles.forEach(function (tt, i) { var h = 58 + ((i * 37) % 5) * 7, x = x0 + i * pitch; svg += '<g class="tgi-row" data-i="' + i + '"><rect x="' + x.toFixed(1) + '" y="' + (108 - h) + '" width="' + (pitch - 6).toFixed(1) + '" height="' + h + '" rx="1.5" class="tgi-gatebox tgi-spine"/><text x="' + (x + (pitch - 6) / 2).toFixed(1) + '" y="104" class="tgi-l" text-anchor="middle">' + String(i + 1) + '</text></g>'; });
    svg += '<text x="512" y="30" class="tgi-l" text-anchor="end">' + n + ' TITLES · READ IN ORDER OR BY NEED</text><text x="512" y="60" class="tgi-s tgi-st" text-anchor="end"></text><text x="512" y="80" class="tgi-l tgi-t" text-anchor="end"></text></svg>';
    return { svg: svg, tick: function (host, t) {
      var i = Math.floor((t / 1600) % n);
      Array.prototype.forEach.call(host.querySelectorAll('.tgi-row'), function (g, k) { g.classList.toggle('is-done', k === i); });
      host.querySelector('.tgi-st').textContent = titles[i]; host.querySelector('.tgi-t').textContent = 'P.0' + (i + 1);
    } };
  }
  var ORDER = [cockpits, cost, strategy, engineering, grid, labs, knowledge];
  function mount() {
    var groups = document.querySelectorAll('.tgrp'); if (!groups.length) return;
    var live = [];
    Array.prototype.forEach.call(groups, function (g, i) {
      var make = ORDER[i]; if (!make) return; var r = make(g); if (!r) return;
      var h3 = g.querySelector('h3'); var box = document.createElement('div'); box.className = 'tgi'; box.innerHTML = r.svg;
      h3.parentNode.insertBefore(box, h3.nextSibling);
      live.push({ host: box, tick: r.tick, on: false });
    });
    if (!live.length) return;
    var t0 = performance.now();
    live.forEach(function (l) { try { l.tick(l.host, REDUCE ? 4200 : 0); } catch (e) { /* a panel that cannot draw stays as rendered */ } });
    if (REDUCE) return;
    if ('IntersectionObserver' in root) { var io = new IntersectionObserver(function (es) { es.forEach(function (e) { for (var i = 0; i < live.length; i++) if (live[i].host === e.target) live[i].on = e.isIntersecting; }); if (root.__rzIllusWake) root.__rzIllusWake(); }, { threshold: 0.2 }); live.forEach(function (l) { io.observe(l.host); }); } else live.forEach(function (l) { l.on = true; });
    /* one loop for all panels, and only while one of them is on screen and the tab is visible */
    var last = 0, raf = null;
    function anyOn() { for (var i = 0; i < live.length; i++) if (live[i].on) return true; return false; }
    function loop(now) {
      raf = null;
      if (now - last > 80) { last = now; for (var i = 0; i < live.length; i++) if (live[i].on) { try { live[i].tick(live[i].host, now - t0); } catch (e) { live[i].on = false; } } }
      if (anyOn() && !document.hidden) raf = requestAnimationFrame(loop);
    }
    function wake() { if (!raf && anyOn() && !document.hidden) raf = requestAnimationFrame(loop); }
    root.__rzIllusWake = wake;
    document.addEventListener('visibilitychange', wake);
    wake();
  }
  root.RZHubIllus = { mount: mount };
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount(); }
})(typeof window !== 'undefined' ? window : this);
