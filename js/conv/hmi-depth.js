/*
 * hmi-depth.js — the depth pass for the Conventional HMI sheets (water WT-M-101, fuel FU-M-101, …).
 * Owner 2026-11-14: "gambar more detail, more immersive, deep shader". The sheet renderer stays
 * flat (it is shared); this pass is opted into per host with class "hmi-depth" and adds, after each
 * update():
 *   - vessel shading: equipment bodies (.b) take a lit-from-the-left body gradient, a cooler one
 *     when the unit is running (CSS in css/conv-hmi-depth.css),
 *   - process pipes as tubes: a narrow sheen line drawn over every process edge,
 *   - liquid in tanks: a medium-coloured fill clipped to the vessel body at the page's level,
 *     with a meniscus line; the level is the same number the tank value prints,
 *   - flange collars where a process pipe meets an equipment port, and a plinth under floor-mounted
 *     equipment (both derived from the drawn geometry, never placed by hand).
 * Geometry is never moved; text is never touched, so the geometry and text-budget gates see the
 * sheet exactly as the renderer drew it.
 */
(function (root) {
  'use strict';
  if (!root) return;
  var NS = 'http://www.w3.org/2000/svg';
  var LIQUID_SYMS = { tankStorage: 1, tankBuffer: 1, tankExpansion: 1 };

  function el(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  function stop(o, cls) { return el('stop', { offset: o, 'class': cls }); }
  function grad(id, x2, y2, stops) {
    var g = el('linearGradient', { id: id, x1: '0', y1: '0', x2: x2, y2: y2 });
    stops.forEach(function (s) { g.appendChild(stop(s[0], s[1])); });
    return g;
  }
  function ensureDefs(svg) {
    var id = svg.id || 'hmi';
    if (svg.querySelector('defs.hd-defs')) return id;
    var d = el('defs', { 'class': 'hd-defs' });
    /* body: lit from the upper left, rim falls off on the right (a cylinder read side-on) */
    d.appendChild(grad(id + '-hd-body', '1', '0', [['0', 'hd-b0'], ['0.32', 'hd-b1'], ['0.7', 'hd-b2'], ['1', 'hd-b3']]));
    d.appendChild(grad(id + '-hd-run', '1', '0', [['0', 'hd-r0'], ['0.32', 'hd-r1'], ['0.7', 'hd-r2'], ['1', 'hd-r3']]));
    ['pw', 'fuel', 'fw', 'cw', 'chw', 'htw', 'dr'].forEach(function (m) {
      /* liquid: bright just under the surface, deepening toward the floor of the vessel */
      d.appendChild(grad(id + '-hd-liq-' + m, '0', '1', [['0', 'hd-l0 hd-m-' + m], ['0.18', 'hd-l1 hd-m-' + m], ['1', 'hd-l2 hd-m-' + m]]));
    });
    /* specular: a narrow highlight band then a shadowed rim — brushed metal read side-on */
    d.appendChild(grad(id + '-hd-spec', '1', '0', [['0', 'hd-s0'], ['0.16', 'hd-s1'], ['0.24', 'hd-s2'], ['0.34', 'hd-s0'], ['0.78', 'hd-s0'], ['1', 'hd-s3']]));
    var rg = el('radialGradient', { id: id + '-hd-spec-r', cx: '0.36', cy: '0.32', r: '0.72', fx: '0.3', fy: '0.26' });
    [['0', 'hd-s2'], ['0.28', 'hd-s1'], ['0.62', 'hd-s0'], ['1', 'hd-s3']].forEach(function (t) { rg.appendChild(stop(t[0], t[1])); });
    d.appendChild(rg);
    /* contact shadow for the whole equipment layer (one filter, not one per element) */
    var f = el('filter', { id: id + '-hd-shadow', x: '-5%', y: '-5%', width: '112%', height: '115%', 'color-interpolation-filters': 'sRGB' });
    f.appendChild(el('feDropShadow', { dx: '1.2', dy: '2.2', stdDeviation: '1.4', 'class': 'hd-shadow' }));
    d.appendChild(f);
    /* plinth: concrete pad, top face lit, front face in shade */
    d.appendChild(grad(id + '-hd-plinth', '0', '1', [['0', 'hd-p0'], ['0.35', 'hd-p1'], ['1', 'hd-p2']]));
    svg.insertBefore(d, svg.firstChild);
    return id;
  }
  function paintBodies(svg, id) {
    svg.querySelectorAll('.hmi-node .b').forEach(function (b) {
      var st = b.closest('.hmi-node').getAttribute('data-state') || '';
      /* an alarm or fault fill is the renderer's message: never shade over it */
      if (/fault|alarm|trip|low|high|fail/.test(st)) { b.style.fill = ''; return; }
      b.style.fill = 'url(#' + id + (st === 'running' ? '-hd-run' : '-hd-body') + ')';
      paintSpecular(b, id);
    });
  }
  /* highlight clipped to the body's own outline, inserted above the fill and below the symbol's strokes */
  function paintSpecular(b, id) {
    var g = b.parentNode, node = b.closest('.hmi-node'), nid = node.getAttribute('data-node') || '';
    /* geometry only: a body keeps its highlight across updates (re-measuring every body on every 1.2 s scan held the
       main thread busy enough on the 10-train CH-M-101 that the page never went network-idle, E3) */
    if (g.querySelector(':scope > .hd-spec')) return;
    var bb; try { bb = b.getBBox(); } catch (e) { return; }
    if (!bb || bb.width < 4 || bb.height < 4) return;
    var round = /^(circle|ellipse)$/i.test(b.tagName), cid = id + '-hd-sc-' + nid + '-' + Array.prototype.indexOf.call(g.children, b);
    var grp = el('g', { 'class': 'hd-spec', 'aria-hidden': 'true' });
    var cp = el('clipPath', { id: cid }); var c = b.cloneNode(false); c.removeAttribute('style'); c.removeAttribute('class'); cp.appendChild(c); grp.appendChild(cp);
    grp.appendChild(el('rect', { x: bb.x, y: bb.y, width: bb.width, height: bb.height, 'clip-path': 'url(#' + cid + ')',
      fill: 'url(#' + id + (round ? '-hd-spec-r' : '-hd-spec') + ')' }));
    /* storage tanks: two shell-course weld seams across the body, clipped to it (plate courses of a welded tank) */
    if (LIQUID_SYMS[node.getAttribute('data-sym')] && bb.height > 24) {
      [0.36, 0.68].forEach(function (f) {
        var y = bb.y + bb.height * f;
        grp.appendChild(el('line', { x1: bb.x, x2: bb.x + bb.width, y1: y, y2: y, 'clip-path': 'url(#' + cid + ')', 'class': 'hd-course' }));
      });
    }
    g.insertBefore(grp, b.nextSibling);
  }
  function paintSheen(svg) {
    var host = svg.querySelector('g.hmi-edges'); if (!host) return;
    var layer = host.querySelector('g.hd-sheen');
    if (!layer) { layer = el('g', { 'class': 'hd-sheen', 'aria-hidden': 'true' }); host.appendChild(layer); }
    var casing = host.querySelector('g.hd-casing');
    if (!casing) { casing = el('g', { 'class': 'hd-casing', 'aria-hidden': 'true' }); host.insertBefore(casing, host.firstChild); }
    var edges = host.querySelectorAll('path.hmi-edge[data-edge]');
    /* same pipes as last time: only the flow state moves, so restamp it on the tube layers already drawn instead of
       rebuilding ~3 paths per pipe on every scan (E3: 209 pipes on the 10-train sheet) */
    if (layer.__hdN === edges.length && layer.childNodes.length) {
      edges.forEach(function (p) { var fl = p.getAttribute('data-flow') || ''; (p.__hd || []).forEach(function (e) { if (e.getAttribute('data-flow') !== fl) e.setAttribute('data-flow', fl); }); });
      return;
    }
    layer.textContent = ''; casing.textContent = ''; layer.__hdN = edges.length;
    edges.forEach(function (p) {
      var c = p.getAttribute('class') || '', d = p.getAttribute('d'), fl = p.getAttribute('data-flow') || '';
      p.__hd = [];
      if (/w-(inst|signal)|m-(power|data|feed_a|feed_b|dc)\b/.test(c) || !/\bm-/.test(c)) return;
      var add = function (parent, e) { parent.appendChild(e); p.__hd.push(e); };
      /* a tube: dark wall under the medium, a highlight riding up-left of the centre line. Chilled water is
         insulated: an aluminium cladding jacket, wider than the bare pipe, with a seam ring every 22 units */
      if (/\bm-chw\b/.test(c)) {
        add(casing, el('path', { d: d, 'class': 'hd-insul', 'data-flow': fl }));
        add(casing, el('path', { d: d, 'class': 'hd-insul-seam', 'data-flow': fl }));
      } else {
        add(casing, el('path', { d: d, 'class': 'hd-casing-line', 'data-flow': fl }));
      }
      add(layer, el('path', { d: d, 'class': 'hd-sheen-line', 'data-flow': fl, transform: 'translate(-0.45 -0.6)' }));
    });
  }
  /* equipment that stands on the floor gets a plinth: a concrete pad under its body, drawn beneath the node layer */
  var NO_PLINTH = /^(junction|offSheet|drain|sprinklerHead|flowMeter|inst|valve|preActionValve|alarmValve|manualStation|abortSwitch|facp|releasePanel|aspirating)/;
  function paintPlinths(svg, id) {
    var nodes = svg.querySelector('g.hmi-nodes'); if (!nodes) return;
    var layer = svg.querySelector('g.hd-plinths');
    if (!layer) { layer = el('g', { 'class': 'hd-plinths', 'aria-hidden': 'true' }); nodes.parentNode.insertBefore(layer, nodes); }
    var count = nodes.querySelectorAll('.hmi-node').length;
    if (layer.childNodes.length && layer.__hdN === count) return;   /* geometry only, as the flanges */
    layer.textContent = ''; layer.__hdN = count;
    var inv; try { inv = svg.getScreenCTM().inverse(); } catch (e) { return; }
    if (!inv) return;
    var pt = svg.createSVGPoint ? svg.createSVGPoint() : null; if (!pt) return;
    function toSvg(x, y) { pt.x = x; pt.y = y; var q = pt.matrixTransform(inv); return [q.x, q.y]; }
    nodes.querySelectorAll('.hmi-node').forEach(function (n) {
      var sym = n.getAttribute('data-sym') || '', b = n.querySelector('.b');
      if (!b || NO_PLINTH.test(sym)) return;
      var r = b.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
      var a = toSvg(r.left, r.top), c = toSvg(r.right, r.bottom), w = c[0] - a[0], h = c[1] - a[1];
      if (w < 18 || h < 18) return;   /* inline fittings and small instruments are not floor-mounted */
      layer.appendChild(el('rect', { x: a[0] - 3, y: c[1] - 0.6, width: w + 6, height: 2.6, rx: 0.8, 'class': 'hd-plinth', fill: 'url(#' + id + '-hd-plinth)' }));
    });
  }
  /* a flange collar where a process pipe meets an equipment port: two short ticks across the pipe */
  function paintFlanges(svg) {
    var host = svg.querySelector('g.hmi-edges'), sheen = host && host.querySelector('g.hd-sheen'); if (!sheen) return;
    var layer = host.querySelector('g.hd-flanges');
    if (!layer) { layer = el('g', { 'class': 'hd-flanges', 'aria-hidden': 'true' }); host.appendChild(layer); }
    var edges = host.querySelectorAll('path.hmi-edge[data-edge]');
    /* flanges follow geometry, not state: drawn once per set of pipes, not on every update */
    if (layer.childNodes.length && layer.__hdN === edges.length) return;
    layer.textContent = ''; layer.__hdN = edges.length;
    edges.forEach(function (p) {
      var c = p.getAttribute('class') || '';
      if (/w-(inst|signal)|m-(power|data|feed_a|feed_b|dc)\b/.test(c) || !/\bm-/.test(c)) return;
      var ends = (p.getAttribute('data-ends') || '').split('|'), L; try { L = p.getTotalLength(); } catch (e) { return; }
      if (!L || L < 14) return;
      [[0, 3, ends[0]], [L, L - 3, ends[1]]].forEach(function (e) {
        var nid = (e[2] || '').split('.')[0]; if (!nid) return;
        var node = svg.querySelector('.hmi-node[data-node="' + nid + '"]'), sym = node && node.getAttribute('data-sym') || '';
        if (!node || /^(junction|offSheet|inst)/.test(sym)) return;
        var p0 = p.getPointAtLength(e[0]), p1 = p.getPointAtLength(e[1]), dx = p1.x - p0.x, dy = p1.y - p0.y, m = Math.sqrt(dx * dx + dy * dy) || 1;
        var ux = dx / m, uy = dy / m, nx = -uy, ny = ux;
        [4.2, 6.2].forEach(function (k) {
          var cx = p0.x + ux * k, cy = p0.y + uy * k;
          layer.appendChild(el('line', { x1: cx - nx * 3.6, y1: cy - ny * 3.6, x2: cx + nx * 3.6, y2: cy + ny * 3.6, 'class': 'hd-flange' }));
        });
      });
    });
  }
  function paintLiquid(svg, id, levels) {
    Object.keys(levels || {}).forEach(function (nid) {
      var lv = levels[nid], node = svg.querySelector('.hmi-node[data-node="' + nid + '"]');
      if (!node || !LIQUID_SYMS[node.getAttribute('data-sym')]) return;
      var body = node.querySelector('.b'); if (!body) return;
      var g = body.parentNode, cid = id + '-hd-clip-' + nid;
      var old = g.querySelector('.hd-liquid'); if (old) old.remove();
      if (!lv || typeof lv.pct !== 'number' || !isFinite(lv.pct)) return;
      var bb = body.getBBox(), pct = Math.max(0, Math.min(100, lv.pct)), h = bb.height * pct / 100, y = bb.y + bb.height - h;
      var grp = el('g', { 'class': 'hd-liquid', 'aria-hidden': 'true' });
      var cp = el('clipPath', { id: cid }); cp.appendChild(body.cloneNode(false)); grp.appendChild(cp);
      grp.appendChild(el('rect', { x: bb.x, y: y, width: bb.width, height: h, 'clip-path': 'url(#' + cid + ')',
        fill: 'url(#' + id + '-hd-liq-' + (lv.medium || 'pw') + ')', 'class': 'hd-liq' }));
      if (pct > 2 && pct < 99) grp.appendChild(el('rect', { x: bb.x, y: y, width: bb.width, height: Math.min(3, h), 'clip-path': 'url(#' + cid + ')', 'class': 'hd-surface' }));
      if (pct > 1 && pct < 99) grp.appendChild(el('line', { x1: bb.x, x2: bb.x + bb.width, y1: y, y2: y, 'clip-path': 'url(#' + cid + ')', 'class': 'hd-meniscus' }));
      g.insertBefore(grp, body.nextSibling);
    });
  }
  /* B7: pause the sheet's motion while it is off screen (one observer per host) */
  function watchViewport(host) {
    if (!host || host.__hdWatch || typeof root.IntersectionObserver !== 'function') return;
    host.__hdWatch = new root.IntersectionObserver(function (es) {
      es.forEach(function (e) { host.classList.toggle('is-offscreen', !e.isIntersecting); });
    }, { threshold: 0 });
    host.__hdWatch.observe(host);
  }
  /** Apply after every sheet.update(). opts.levels = {nodeId: {pct, medium}}; null pct removes the liquid. */
  function apply(svg, opts) {
    if (!svg || !svg.closest('.hmi-depth')) return;
    watchViewport(svg.closest('.hmi-depth'));
    /* The shaded sheet is pinned to one theme on its host, but RZHmiSheet keeps its gradients in ONE document-level
       <svg class="hmi-defs"> that reads the DOCUMENT theme. On a page without data-theme the canvas and body fills
       resolved to the light set under dark-theme text: light letters readable only through their halo. The defs
       follow the host's pin. */
    var pin = svg.closest('.hmi-depth').getAttribute('data-theme'), shared = root.document.querySelector('svg.hmi-defs');
    if (pin && shared && shared.getAttribute('data-theme') !== pin) shared.setAttribute('data-theme', pin);
    var id = ensureDefs(svg);
    var nodes = svg.querySelector('g.hmi-nodes'); if (nodes) nodes.setAttribute('filter', 'url(#' + id + '-hd-shadow)');
    paintBodies(svg, id);
    paintSheen(svg);
    paintLiquid(svg, id, (opts && opts.levels) || {});
    paintFlanges(svg);
    paintPlinths(svg, id);
    if (root.RZConvTruth && root.RZConvTruth.marks) root.RZConvTruth.marks(svg);   /* B4 alarm / ack marks */
  }
  root.RZHmiDepth = { apply: apply };
})(typeof window !== 'undefined' ? window : null);
