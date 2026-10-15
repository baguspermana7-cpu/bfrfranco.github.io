/* rz-home-scene.js — the career drawn as a single-line diagram (index mockup, PLAN H1).
 *
 * One pinned drawing: a busbar of five employers fed in sequence, a readout panel
 * of the published results, and the certification plates. Sections move the
 * camera; rows light the feeder they name. Every number drawn is a number the
 * page already states — nothing is generated.
 */
(function () {
  'use strict';
  if (window.__rzHomeScene) return; window.__rzHomeScene = true;
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SVG = 'http://www.w3.org/2000/svg', W = 1200, H = 760;
  var C30 = Math.cos(Math.PI / 6), S30 = Math.sin(Math.PI / 6);
  function el(tag, attrs, parent) { var n = document.createElementNS(SVG, tag); for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function txt(parent, x, y, s, cls, anchor) { var t = el('text', { x: x, y: y, 'class': cls || 'ft', 'text-anchor': anchor || 'start' }, parent); t.textContent = s; return t; }
  function pts(l) { return l.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }
  function iso(x, y, z, o) { return [o.x + (x - y) * C30, o.y + (x + y) * S30 - z]; }
  function box(g, x, y, w, d, h, o, cls) {
    var p = function (a, b, c) { return iso(a, b, c, o); };
    el('polygon', { points: pts([p(x, y, h), p(x + w, y, h), p(x + w, y + d, h), p(x, y + d, h)]), 'class': cls || 'fl' }, g);
    el('polyline', { points: pts([p(x, y + d, h), p(x, y + d, 0), p(x + w, y + d, 0), p(x + w, y + d, h)]), 'class': cls || 'fl' }, g);
    el('polyline', { points: pts([p(x + w, y + d, 0), p(x + w, y, 0), p(x + w, y, h)]), 'class': cls || 'fl' }, g);
  }
  var CAM = {};
  function build(svg, data) {
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var cam = el('g', { id: 'cam' }, svg);

    /* -- the career bus: five feeders in sequence, breakers between -- */
    var sld = el('g', { 'class': 'zone', 'data-zone': 'sld' }, cam);
    el('line', { x1: 80, y1: 150, x2: 1120, y2: 150, 'class': 'fl t1' }, sld);
    txt(sld, 80, 134, 'CAREER BUS · 2011 → PRESENT', 'ft lod-wide lod-timeline');
    data.jobs.forEach(function (j, i) {
      var x = 150 + i * 210, node = el('g', { 'class': 'node', 'data-node': j.id }, sld);
      el('line', { x1: x, y1: 150, x2: x, y2: 200, 'class': 'fx pwr' }, node);
      el('rect', { x: x - 5, y: 168, width: 10, height: 10, 'class': 'brk' }, node);            /* breaker */
      el('rect', { x: x - 70, y: 200, width: 140, height: 64, rx: 2, 'class': 'fl' }, node);
      txt(node, x, 222, j.years, 'ft lod-wide lod-timeline', 'middle');
      txt(node, x, 240, j.co, 'fv lod-timeline', 'middle');
      txt(node, x, 254, j.role, 'fv lod-timeline', 'middle');
      if (j.award) { el('polygon', { points: pts([[x + 70, 200], [x + 94, 190], [x + 70, 180]]), 'class': 'fl' }, node); txt(node, x + 98, 188, j.award, 'ft lod-timeline'); }
      /* a load block under each feeder: what was carried */
      el('line', { x1: x, y1: 264, x2: x, y2: 292, 'class': 'fx pwr' }, node);
      box(node, 0, 0, 60, 40, 18, { x: x, y: 300 }, 'fl t3');
      txt(node, x, 344, j.load, 'fv lod-timeline', 'middle');
    });
    /* the present: the live feeder stays closed and carries the site */
    txt(sld, 1120, 134, 'LIVE', 'ft lod-wide lod-timeline', 'end');
    CAM.hero = [0, 0, W, H]; CAM.timeline = [60, 100, 1100, 290];

    /* -- readout panel: the results the page states -- */
    var pan = el('g', { 'class': 'zone', 'data-zone': 'results', transform: 'translate(120,430)' }, cam);
    el('rect', { x: -16, y: -28, width: 560, height: 220, rx: 2, 'class': 'fl t3' }, pan);
    txt(pan, 0, -10, 'OPERATIONAL READOUTS · AS PUBLISHED ON THIS PAGE', 'ft lod-results');
    data.readouts.forEach(function (r, i) {
      var x = (i % 2) * 272, y = Math.floor(i / 2) * 92, node = el('g', { 'class': 'node', 'data-node': r.id }, pan);
      el('rect', { x: x, y: y, width: 256, height: 76, rx: 2, 'class': 'fl' }, node);
      txt(node, x + 12, y + 20, r.label, 'ft lod-results');
      txt(node, x + 12, y + 52, r.value, 'fk lod-results');
      txt(node, x + 244, y + 66, r.note, 'fv lod-results', 'end');
      /* a 7px status dot — the one state device the stat tile keeps */
      el('circle', { cx: x + 240, cy: y + 16, r: 3.5, 'class': 'fd' }, node);
    });
    CAM.results = [90, 390, 600, 250];

    /* -- certification plates -- */
    var pl = el('g', { 'class': 'zone', 'data-zone': 'plates' }, cam), po = { x: 900, y: 470 };
    data.certs.forEach(function (n, i) { var oo = { x: po.x, y: po.y + 100 - i * 18 }; box(pl, 0, 0, 100, 100, 5, oo, i === data.certs.length - 1 ? 'fl' : 'fl t3'); var p = iso(100, 50, 2, oo); el('line', { x1: p[0], y1: p[1], x2: p[0] + 18, y2: p[1], 'class': 'fl t3' }, pl); txt(pl, p[0] + 22, p[1] + 3, n, 'ft lod-about'); });
    txt(pl, po.x - 100, po.y + 160, 'authorisations that let one person switch live HV', 'fv lod-about');
    CAM.about = [700, 380, 480, 320];
    CAM.contact = [0, 0, W, H];
    return cam;
  }
  function fit(rect) { var s = Math.min(W / rect[2], H / rect[3]) * 0.92, cx = rect[0] + rect[2] / 2, cy = rect[1] + rect[3] / 2; return 'translate(' + (W / 2 - cx * s) + 'px, ' + (H / 2 - cy * s) + 'px) scale(' + s + ')'; }
  function init() {
    var host = document.getElementById('homeScene'); if (!host) return;
    var data; try { data = JSON.parse(document.getElementById('homeSceneData').textContent); } catch (e) { return; }
    var svg = el('svg', { role: 'group', 'aria-label': 'Career drawn as a single-line diagram: five employers on one bus, operational readouts, certification plates', focusable: 'false' });
    var cam = build(svg, data); host.querySelector('.scene-body').appendChild(svg);
    var caps = {}; Array.prototype.forEach.call(host.querySelectorAll('[data-cap]'), function (c) { caps[c.getAttribute('data-cap')] = c; });
    var current = null;
    function go(name) {
      if (!CAM[name] || name === current) return; current = name;
      cam.style.transform = fit(CAM[name]); host.setAttribute('data-cam', name);
      host.classList.toggle('is-live', name === 'timeline' || name === 'results');
      for (var k in caps) caps[k].classList.toggle('is-on', k === name);
    }
    cam.style.transformOrigin = '0 0'; if (!REDUCE) cam.style.transition = 'transform 900ms cubic-bezier(.77,0,.175,1)';
    go('hero');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) go(e.target.getAttribute('data-cam-target')); }); }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
      Array.prototype.forEach.call(document.querySelectorAll('[data-cam-target]'), function (s) { io.observe(s); });
    }
    if (!REDUCE) requestAnimationFrame(function () { host.classList.add('is-in'); }); else host.classList.add('is-in');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
