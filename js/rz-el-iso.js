/*
 * rz-el-iso.js — window.RZElIso: the 3D equipment view of the electrical cockpits (PRD-ELECTRICAL-BMS decision 5, law E6).
 *
 * The one-line stays the authority; this view answers "where is it". It draws the real equipment as isometric boxes on
 * true 30° axes (the same projection as the data hall floor, js/conv/floor-plan.js: x' = (x − y)·cos 30°, y' = (x + y)·sin 30° − z):
 * grey bodies from the theme tokens, one front height per equipment class, a lamp whose colour is the state of the
 * one-line device the unit stands for, nothing coloured unless it is running, warning or in alarm.
 *
 *   RZElIso.mount(host, spec) -> { refresh(), el }
 *   spec = { label, zones: [{ id, label, cls, at: [x, y], cols, size: [w, d, h], gap: [gx, gy], units: [{ node, tag }] }],
 *            stateOf(node) -> 'running' | 'standby' | 'stopped' | 'alarm' | 'warn' | 'nodata',
 *            symbolOf(node) -> the one-line tag of that symbol (optional),
 *            open(node) }      // a click or Enter on a unit opens the same HMI as its symbol on the one-line
 *   unit = { node, tag, rep }   // rep: how many real units share that one-line symbol (its state is the group's);
 *                               // node null = the one-line draws no symbol for it: lamp NO DATA, not selectable
 *
 * Counts are the caller's (from the engine or the one-line); this file holds geometry only.
 */
(function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var C = Math.cos(Math.PI / 6), S = 0.5;          /* 30° axes */
  var FONT = 5, LAMP_R = 1.9, PAD = 14, PHONE_PX = 11;   /* drawing units; px */

  var WORD = { running: 'running', standby: 'standby', stopped: 'off or open', alarm: 'alarm', warn: 'warning', nodata: 'no state on the one-line' };
  function P(x, y, z) { return [(x - y) * C, (x + y) * S - z]; }
  function pts(a) { return a.map(function (p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }).join(' '); }
  function el(tag, attrs, text) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }
  function esc(s) { return String(s == null ? '' : s); }

  function layout(zone) {
    var w = zone.size[0], d = zone.size[1], h = zone.size[2], gx = (zone.gap || [4, 6])[0], gy = (zone.gap || [4, 6])[1];
    var cols = zone.cols || zone.units.length;
    return zone.units.map(function (u, i) {
      var c = i % cols, r = Math.floor(i / cols);
      var x0 = zone.at[0] + c * (w + gx), y0 = zone.at[1] + r * (d + gy);
      return { u: u, x0: x0, y0: y0, x1: x0 + w, y1: y0 + d, h: h };
    });
  }

  function mount(host, spec) {
    var boxes = [], plates = [];
    spec.zones.forEach(function (z) {
      var L = layout(z);
      if (!L.length) return;
      var xs = L.map(function (b) { return b.x1; }), ys = L.map(function (b) { return b.y1; });
      plates.push({ z: z, x0: z.at[0] - 4, y0: z.at[1] - 4, x1: Math.max.apply(null, xs) + 4, y1: Math.max.apply(null, ys) + 4 });
      L.forEach(function (b) { b.cls = z.cls; boxes.push(b); });
    });
    /* painter's order: the farther corner (smaller x + y) first */
    boxes.sort(function (a, b) { return (a.x0 + a.y0) - (b.x0 + b.y0); });

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function grow(p) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    plates.forEach(function (p) { [P(p.x0, p.y0, 0), P(p.x1, p.y0, 0), P(p.x1, p.y1, 0), P(p.x0, p.y1, 0)].forEach(grow); });
    boxes.forEach(function (b) { grow(P(b.x0, b.y0, b.h)); grow(P(b.x1, b.y0, b.h)); grow(P(b.x0, b.y1, 0)); grow(P(b.x1, b.y1, 0)); });
    plates.forEach(function (p) { grow(P(p.x0, p.y1 + FONT * 2.5, 0)); });   /* room for the captions on the floor in front */

    var svg = el('svg', { 'class': 'el-iso-svg', viewBox: [minX - PAD, minY - PAD, maxX - minX + 2 * PAD, maxY - minY + 2 * PAD].map(function (v) { return v.toFixed(1); }).join(' '),
      role: 'group', 'aria-label': esc(spec.label), 'data-axes': '30' });
    var gPlates = el('g', { 'class': 'el-iso-plates' }), gUnits = el('g', { 'class': 'el-iso-units' }), gText = el('g', { 'class': 'el-iso-text' });
    svg.appendChild(gPlates); svg.appendChild(gUnits); svg.appendChild(gText);

    plates.forEach(function (p) {
      gPlates.appendChild(el('polygon', { 'class': 'el-iso-plate', points: pts([P(p.x0, p.y0, 0), P(p.x1, p.y0, 0), P(p.x1, p.y1, 0), P(p.x0, p.y1, 0)]) }));
      /* the caption runs along the plate's front edge on the floor in front of it (the x axis, 30° on screen), so it never
         sits over a unit; zones leave a floor strip for it */
      var c = P(p.x0 + 1, p.y1 + FONT * 1.5, 0);
      gText.appendChild(el('text', { 'class': 'el-iso-caption', x: c[0].toFixed(1), y: c[1].toFixed(1), 'font-size': FONT,
        transform: 'rotate(30 ' + c[0].toFixed(1) + ' ' + c[1].toFixed(1) + ')' }, p.z.label + ' · ' + p.z.units.length));
    });

    var units = [];
    boxes.forEach(function (b) {
      var sel = !!b.u.node;
      var g = el('g', { 'class': 'el-iso-unit', 'data-el-cls': b.cls, 'data-node': b.u.node, 'data-tag': b.u.tag, 'data-front-h': b.h,
        'data-rep': b.u.rep || 1, tabindex: sel ? '0' : null, role: sel ? 'button' : 'img', 'aria-label': esc(b.u.tag) });
      var title = el('title', {}, esc(b.u.tag));
      g.appendChild(title);
      g.appendChild(el('polygon', { 'class': 'el-iso-r', points: pts([P(b.x1, b.y0, b.h), P(b.x1, b.y1, b.h), P(b.x1, b.y1, 0), P(b.x1, b.y0, 0)]) }));
      g.appendChild(el('polygon', { 'class': 'el-iso-l', 'data-face': 'front', points: pts([P(b.x0, b.y1, b.h), P(b.x1, b.y1, b.h), P(b.x1, b.y1, 0), P(b.x0, b.y1, 0)]) }));
      g.appendChild(el('polygon', { 'class': 'el-iso-top', 'data-face': 'top', points: pts([P(b.x0, b.y0, b.h), P(b.x1, b.y0, b.h), P(b.x1, b.y1, b.h), P(b.x0, b.y1, b.h)]) }));
      var lp = P(b.x0 + Math.min(4, (b.x1 - b.x0) * 0.3), b.y1, b.h - Math.min(4, b.h * 0.25));
      var lamp = el('circle', { 'class': 'el-iso-lamp', cx: lp[0].toFixed(2), cy: lp[1].toFixed(2), r: LAMP_R });
      g.appendChild(lamp);
      function go() { if (sel && spec.open) spec.open(b.u.node, b.u); }
      if (sel) {
        g.addEventListener('click', go);
        g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } });
      }
      gUnits.appendChild(g);
      units.push({ g: g, lamp: lamp, u: b.u, title: title });
    });

    var wrap = document.createElement('div');
    wrap.className = 'el-iso';
    /* phone floor (law E7): the width at which a caption renders PHONE_PX; css/rz-hmi.css applies it under 600 px and the box pans */
    wrap.style.setProperty('--el-iso-phone-w', Math.ceil((maxX - minX + 2 * PAD) * PHONE_PX / FONT) + 'px');
    wrap.appendChild(svg);
    host.innerHTML = '';
    host.appendChild(wrap);

    /* on a phone the drawing is wider than the screen: the caller centres it each time the view is shown */
    var centred = false;
    function centre() { if (!centred && wrap.scrollWidth > wrap.clientWidth) { wrap.scrollLeft = (wrap.scrollWidth - wrap.clientWidth) / 2; centred = true; } }

    function refresh() {
      units.forEach(function (x) {
        var st = (x.u.node && spec.stateOf && spec.stateOf(x.u.node)) || 'nodata';
        var sym = x.u.node && spec.symbolOf ? spec.symbolOf(x.u.node) : null;
        var words = x.u.tag + ', ' + WORD[st] + (!x.u.node ? ' (the one-line draws no symbol for it)'
          : (x.u.rep || 1) > 1 ? ' (state of ' + sym + ', one symbol for ' + x.u.rep + ' units)' : sym ? ' (' + sym + ')' : '');
        x.g.setAttribute('data-state', st);
        x.lamp.setAttribute('data-lamp-state', st);
        x.g.setAttribute('aria-label', words);
        x.title.textContent = words;
      });
    }
    refresh();
    return { refresh: refresh, centre: centre, el: wrap };
  }

  /* the 3D | One-line switch: two buttons, arrow keys move between them, the choice is stored per page */
  function projSwitch(host, key, onChange) {
    var stored = null;
    try { stored = localStorage.getItem(key); } catch (x) { stored = null; }
    var cur = stored === 'iso' ? 'iso' : 'line';
    host.classList.add('el-proj');
    host.setAttribute('role', 'group');
    host.setAttribute('aria-label', 'Electrical view');
    host.innerHTML = '<button type="button" data-proj="iso" aria-pressed="false">3D</button><button type="button" data-proj="line" aria-pressed="false">One-line</button>';
    var btns = host.querySelectorAll('button');
    function set(p, store) {
      cur = p;
      for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-pressed', btns[i].getAttribute('data-proj') === p ? 'true' : 'false');
      if (store) { try { localStorage.setItem(key, p); } catch (x) { /* storage blocked: the choice lasts the visit */ } }
      onChange(p);
    }
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () { set(this.getAttribute('data-proj'), true); });
      btns[i].addEventListener('keydown', function (ev) {
        if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
        ev.preventDefault();
        var o = this === btns[0] ? btns[1] : btns[0];
        o.focus(); set(o.getAttribute('data-proj'), true);
      });
    }
    set(cur, false);
    return { get: function () { return cur; }, set: set };
  }

  root.RZElIso = { mount: mount, projSwitch: projSwitch, version: '1.0.0' };
})(typeof window !== 'undefined' ? window : this);
