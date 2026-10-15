/* rz-hub.js — figures and micro-interactions for the DC Solutions hub (PLAN H1).
 *
 * Figures are dotted schematics drawn from a compact spec at runtime (zero-build,
 * no coordinates typed into HTML). Motion is state-driven, never cursor-driven:
 *   - a figure is drawn in once, like a plotter, when it enters the viewport
 *   - hovering or focusing a figure (or a row bound to it) makes its flow paths run
 *     and its status read LIVE; leaving returns it to IDLE
 *   - a row and a figure node that share data-node light together
 *   - the section index follows the viewport
 *   - the metabar numbers count up once
 * Reduced motion: no draw-in, no flow, no count-up — states still change.
 */
(function () {
  'use strict';
  if (window.__rzHub) return; window.__rzHub = true;
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SVG = 'http://www.w3.org/2000/svg';

  /* ---------- tiny svg helpers ---------- */
  function el(tag, attrs, parent) {
    var n = document.createElementNS(SVG, tag);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function txt(parent, x, y, s, cls, anchor) {
    var t = el('text', { x: x, y: y, 'class': cls || 'ft', 'text-anchor': anchor || 'start' }, parent);
    t.textContent = s; return t;
  }
  function pts(list) { return list.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }
  /* isometric projection: x along, y across, z up */
  var C30 = Math.cos(Math.PI / 6), S30 = Math.sin(Math.PI / 6);
  function iso(x, y, z, o) { return [o.x + (x - y) * C30, o.y + (x + y) * S30 - z]; }
  function isoBox(g, x, y, w, d, h, o, cls) {
    var p = function (a, b, c) { return iso(a, b, c, o); };
    var top = [p(x, y, h), p(x + w, y, h), p(x + w, y + d, h), p(x, y + d, h)];
    el('polygon', { points: pts(top), 'class': cls || 'fl' }, g);
    el('polyline', { points: pts([p(x, y + d, h), p(x, y + d, 0), p(x + w, y + d, 0), p(x + w, y + d, h)]), 'class': cls || 'fl' }, g);
    el('polyline', { points: pts([p(x + w, y + d, 0), p(x + w, y, 0), p(x + w, y, h)]), 'class': cls || 'fl' }, g);
  }

  /* ---------- figure specs ---------- */
  var FIGS = {
    /* FIG 0.0 — power and cooling chain of one hall; nodes bound to rows */
    chain: function (svg) {
      svg.setAttribute('viewBox', '0 0 420 230');
      var g = el('g', {}, svg);
      var row = function (y, nodes, flowCls) {
        var x = 8, prev = null;
        nodes.forEach(function (n) {
          var w = n.w || 62, node = el('g', { 'class': 'node', 'data-node': n.id }, g);
          el('rect', { x: x, y: y, width: w, height: 34, rx: 2, 'class': 'fl' }, node);
          txt(node, x + w / 2, y + 15, n.l, 'ft', 'middle');
          txt(node, x + w / 2, y + 27, n.v, 'fv', 'middle');
          if (prev !== null) {
            el('line', { x1: prev, y1: y + 17, x2: x, y2: y + 17, 'class': 'fx ' + flowCls }, g);
            /* a breaker (power) or a valve (cooling) on every link — the chain is switchable */
            if (flowCls === 'pwr') el('rect', { x: prev + 6, y: y + 14, width: 6, height: 6, 'class': 'brk' }, g);
            else el('polygon', { points: pts([[prev + 6, y + 14], [prev + 12, y + 20], [prev + 12, y + 14], [prev + 6, y + 20]]), 'class': 'brk' }, g);
          }
          prev = x + w; x += w + 18;
        });
        return prev;
      };
      row(24, [
        { id: 'grid', l: 'Grid', v: '150 kV' }, { id: 'tx', l: 'TX', v: '20 / 0.4' }, { id: 'ups', l: 'UPS', v: '2N' },
        { id: 'rpp', l: 'RPP', v: '400 V' }, { id: 'rack', l: 'Rack', v: 'IT kW' }
      ], 'pwr');
      row(120, [
        { id: 'dry', l: 'Dry clr', v: 'ambient' }, { id: 'chiller', l: 'Chiller', v: 'COP' }, { id: 'cdu', l: 'CDU', v: 'TCS' },
        { id: 'manifold', l: 'Manifold', v: 'L/min' }, { id: 'rack2', l: 'Rack', v: 'kW_th' }
      ], 'cool');
      /* heat returns from the rack row to the cooling row — the loop closes */
      el('polyline', { points: pts([[359, 58], [359, 92], [390, 92], [390, 137], [390, 137]]), 'class': 'fx cool' }, g);
      el('polyline', { points: pts([[390, 137], [390, 154], [368, 154]]), 'class': 'fx cool' }, g);
      txt(g, 394, 100, 'HEAT', 'ft');
      /* dimension line under the chain */
      el('line', { x1: 8, y1: 186, x2: 368, y2: 186, 'class': 'fl t3' }, g);
      el('line', { x1: 8, y1: 182, x2: 8, y2: 190, 'class': 'fl t3' }, g);
      el('line', { x1: 368, y1: 182, x2: 368, y2: 190, 'class': 'fl t3' }, g);
      /* a busbar under the power row and a header under the cooling row */
      el('line', { x1: 8, y1: 70, x2: 368, y2: 70, 'class': 'fl t1' }, g); txt(g, 374, 73, '400 V bus', 'ft');
      el('line', { x1: 8, y1: 166, x2: 368, y2: 166, 'class': 'fl t1' }, g); txt(g, 374, 169, 'TCS header', 'ft');
      txt(g, 188, 202, 'Utility  →  IT load, one hall', 'ft', 'middle');
      txt(g, 188, 218, 'every box is a calculator on this page', 'fv', 'middle');
    },
    /* FIG 0.1 — campus: two halls, plant yard, substation (isometric, dotted) */
    campus: function (svg) {
      svg.setAttribute('viewBox', '0 0 320 200');
      var g = el('g', {}, svg), o = { x: 160, y: 60 };
      /* site boundary */
      el('polygon', { points: pts([iso(0, 0, 0, o), iso(240, 0, 0, o), iso(240, 150, 0, o), iso(0, 150, 0, o)]), 'class': 'fl t3' }, g);
      isoBox(g, 20, 20, 90, 50, 34, o);           /* hall A */
      isoBox(g, 125, 20, 90, 50, 34, o);          /* hall B */
      isoBox(g, 20, 90, 40, 40, 16, o);           /* plant */
      isoBox(g, 75, 95, 30, 30, 10, o);           /* gensets */
      isoBox(g, 170, 95, 50, 40, 8, o);           /* substation */
      for (var i = 0; i < 5; i++) isoBox(g, 28 + i * 16, 100, 8, 20, 12, o, 'fl t3'); /* chillers */
      var pa = iso(195, 115, 8, o), pb = iso(65, 45, 34, o);
      el('polyline', { points: pts([pa, [pa[0], pa[1] - 40], [pb[0], pa[1] - 40], pb]), 'class': 'fx' }, g);
      txt(g, iso(65, 45, 34, o)[0], iso(65, 45, 34, o)[1] - 46, 'HALL A', 'ft', 'middle');
      txt(g, iso(170, 45, 34, o)[0], iso(170, 45, 34, o)[1] - 46, 'HALL B', 'ft', 'middle');
      txt(g, iso(195, 115, 8, o)[0] + 16, iso(195, 115, 8, o)[1] + 4, '150 kV', 'ft');
      txt(g, iso(40, 110, 16, o)[0] - 56, iso(40, 110, 16, o)[1] + 4, 'PLANT', 'ft');
    },
    /* FIG 0.2 — one hall: rack rows, hot aisles, CDU gallery */
    hall: function (svg) {
      svg.setAttribute('viewBox', '0 0 320 200');
      var g = el('g', {}, svg), o = { x: 160, y: 40 };
      isoBox(g, 0, 0, 200, 120, 2, o, 'fl t3');
      for (var r = 0; r < 6; r++) {
        var y = 12 + r * 18;
        for (var c = 0; c < 10; c++) isoBox(g, 16 + c * 17, y, 12, 8, 14, o, r % 2 ? 'fl t3' : 'fl');
      }
      isoBox(g, 8, 4, 6, 112, 10, o);
      var a = iso(8, 60, 10, o), b = iso(190, 60, 0, o);
      el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], 'class': 'fx' }, g);
      txt(g, iso(100, -14, 2, o)[0], iso(100, -14, 2, o)[1], '10 ROWS · 880 RACKS', 'ft', 'middle');
      txt(g, iso(8, 130, 10, o)[0] - 10, iso(8, 130, 10, o)[1] + 12, 'CDU GALLERY', 'ft', 'end');
    },
    /* FIG 0.3 — grid tiers: 500 / 275 / 150 kV ladder with tier-graded strokes */
    grid: function (svg) {
      svg.setAttribute('viewBox', '0 0 320 200');
      var g = el('g', {}, svg);
      var tiers = [['500 kV', 40, 't1'], ['275 kV', 100, ''], ['150 kV', 160, 't3']];
      tiers.forEach(function (t, i) {
        el('line', { x1: 60, y1: t[1], x2: 300, y2: t[1], 'class': 'fl ' + t[2] }, g);
        txt(g, 52, t[1] + 4, t[0], 'ft', 'end');
        for (var k = 0; k < 4 + i * 2; k++) {
          var x = 80 + k * (220 / (3 + i * 2));
          el('rect', { x: x - 3, y: t[1] - 3, width: 6, height: 6, 'class': 'fl ' + t[2] }, g);
          if (i < 2) el('line', { x1: x, y1: t[1] + 3, x2: x + 10, y2: tiers[i + 1][1] - 3, 'class': 'fx' }, g);
        }
      });
      txt(g, 180, 192, 'substations · generation mix · headroom per region', 'fv', 'middle');
    },
    /* FIG 0.4 — a cost ledger: stacked CAPEX bars become an OPEX line */
    ledger: function (svg) {
      svg.setAttribute('viewBox', '0 0 320 200');
      var g = el('g', {}, svg);
      el('line', { x1: 30, y1: 160, x2: 300, y2: 160, 'class': 'fl t3' }, g);
      el('line', { x1: 30, y1: 20, x2: 30, y2: 160, 'class': 'fl t3' }, g);
      var h = [120, 70, 46, 32, 26, 22];
      h.forEach(function (v, i) {
        var x = 44 + i * 42;
        el('rect', { x: x, y: 160 - v, width: 26, height: v, 'class': i ? 'fl t3' : 'fl' }, g);
        txt(g, x + 13, 174, i ? 'Y' + i : 'CAPEX', 'ft', 'middle');
      });
      el('polyline', { points: pts(h.map(function (v, i) { return [57 + i * 42, 160 - v - 10]; })), 'class': 'fx' }, g);
      txt(g, 34, 16, 'US$ / MW', 'ft');
      txt(g, 165, 192, 'build · operate · compare · export', 'fv', 'middle');
    },
    /* FIG 0.5 — stacked plates: the standards a design has to satisfy */
    plates: function (svg) {
      svg.setAttribute('viewBox', '0 0 320 200');
      var g = el('g', {}, svg), o = { x: 160, y: 70 }, names = ['TIA-942', 'ASHRAE', 'ISO 50001', 'NFPA', 'UPTIME'];
      names.forEach(function (n, i) {
        var z = i * 22;
        isoBox(g, 0, 0, 110, 110, 6, { x: o.x, y: o.y + 80 - z }, i === 4 ? 'fl' : 'fl t3');
        var p = iso(110, 55, 3, { x: o.x, y: o.y + 80 - z });
        el('line', { x1: p[0], y1: p[1], x2: p[0] + 22, y2: p[1], 'class': 'fl t3' }, g);
        txt(g, p[0] + 26, p[1] + 3, n, 'ft');
      });
      var a = iso(55, 55, 6, { x: o.x, y: o.y + 80 }), b = iso(55, 55, 6, { x: o.x, y: o.y - 8 });
      el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], 'class': 'fx' }, g);
    }
  };

  function hashGutter(fig) {
    var h = document.createElement('div'); h.className = 'hash'; h.setAttribute('aria-hidden', 'true');
    var s = ''; for (var i = 0; i < 60; i++) s += '#\n'; h.textContent = s; fig.appendChild(h);
  }

  function buildFigures() {
    var figs = document.querySelectorAll('.hub-fig[data-fig]');
    Array.prototype.forEach.call(figs, function (fig) {
      var kind = fig.getAttribute('data-fig'), draw = FIGS[kind];
      if (!draw) return;
      var body = document.createElement('div'); body.className = 'fig-body';
      var svg = el('svg', { role: 'img', 'aria-label': fig.getAttribute('data-label') || kind, focusable: 'false' });
      draw(svg); body.appendChild(svg); fig.appendChild(body); hashGutter(fig);
      if (REDUCE || !('IntersectionObserver' in window)) { fig.classList.add('is-in'); return; }
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { fig.classList.add('is-in'); io.disconnect(); } });
      }, { threshold: 0.35 });
      io.observe(fig);
    });
  }

  /* ---------- live state: figure <-> bound rows ---------- */
  function setLive(fig, on) {
    fig.classList.toggle('is-live', on);
    var st = fig.querySelector('.fig-cap .st');
    if (st) st.textContent = on ? '→ STATUS  LIVE' : '→ STATUS  IDLE';
  }
  function bindLive() {
    var figs = document.querySelectorAll('.hub-fig');
    Array.prototype.forEach.call(figs, function (fig) {
      var owner = fig.closest('[data-fig-owner]') || fig;
      owner.addEventListener('pointerenter', function () { setLive(fig, true); });
      owner.addEventListener('pointerleave', function () { setLive(fig, false); });
      owner.addEventListener('focusin', function () { setLive(fig, true); });
      owner.addEventListener('focusout', function (e) { if (!owner.contains(e.relatedTarget)) setLive(fig, false); });
    });
    /* rows bound to a chain node: hover either side and both light; a node is a link to its rows */
    var rows = document.querySelectorAll('a[data-node]');
    var byNode = {};
    Array.prototype.forEach.call(rows, function (row) {
      var id = row.getAttribute('data-node'); (byNode[id] = byNode[id] || []).push(row);
      var hot = function (on) {
        var peers = document.querySelectorAll('[data-node="' + id + '"]');
        Array.prototype.forEach.call(peers, function (p) { p.classList.toggle('is-hot', on); });
        var figs = document.querySelectorAll('.hub-fig[data-fig="chain"]');
        Array.prototype.forEach.call(figs, function (fig) { setLive(fig, on); });
        if (on && window.__rzHubCam && id !== 'building' && id !== 'gensets' && id !== 'plant') { /* a row names a chain box: the camera is already there while the section is in view */ }
      };
      row.addEventListener('pointerenter', function () { hot(true); });
      row.addEventListener('pointerleave', function () { hot(false); });
      row.addEventListener('focusin', function () { hot(true); });
      row.addEventListener('focusout', function () { hot(false); });
    });
    var nodes = document.querySelectorAll('.hub-fig .node[data-node], .hub-scene .node[data-node]');
    Array.prototype.forEach.call(nodes, function (node) {
      var id = node.getAttribute('data-node'), bound = byNode[id] || [];
      var t = el('title', {}, node);
      t.textContent = bound.length ? bound.map(function (r) { var h = r.querySelector('.t, h3'); return h ? h.firstChild.textContent.trim() : ''; }).filter(Boolean).join(' · ') : 'nothing bound yet';
      if (!bound.length) return;
      node.setAttribute('data-bound', bound.length); node.setAttribute('tabindex', '0'); node.setAttribute('role', 'link');
      var go = function () { var r = bound[0]; r.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'center' }); r.focus({ preventScroll: true }); };
      node.addEventListener('click', go);
      node.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      var hot = function (on) { Array.prototype.forEach.call(document.querySelectorAll('[data-node="' + id + '"]'), function (p) { p.classList.toggle('is-hot', on); }); };
      node.addEventListener('pointerenter', function () { hot(true); });
      node.addEventListener('pointerleave', function () { hot(false); });
    });
  }

  /* ---------- section index ---------- */
  function sectionIndex() {
    var links = document.querySelectorAll('.hub-index a[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    Array.prototype.forEach.call(links, function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        Array.prototype.forEach.call(links, function (a) { a.classList.remove('is-active'); });
        var a = map[e.target.id]; if (a) a.classList.add('is-active');
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* ---------- metabar count-up, once ---------- */
  function countUp() {
    var nums = document.querySelectorAll('.hub-metabar b[data-count]');
    if (!nums.length) return;
    Array.prototype.forEach.call(nums, function (b) {
      var target = parseInt(b.getAttribute('data-count'), 10), suffix = b.getAttribute('data-suffix') || '';
      if (REDUCE || isNaN(target)) { b.textContent = target + suffix; return; }
      var t0 = null, dur = 600;
      function step(ts) {
        if (!t0) t0 = ts;
        var k = Math.min(1, (ts - t0) / dur); k = 1 - Math.pow(1 - k, 3);
        b.textContent = Math.round(target * k) + suffix;
        if (k < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  /* ---------- reveal (opacity only, once) ---------- */
  function reveal() {
    var els = document.querySelectorAll('.rz-reveal');
    if (!els.length) return;
    if (REDUCE || !('IntersectionObserver' in window)) { Array.prototype.forEach.call(els, function (e) { e.classList.add('is-visible'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    Array.prototype.forEach.call(els, function (e) { io.observe(e); });
  }

  function init() { buildFigures(); bindLive(); sectionIndex(); countUp(); reveal(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
