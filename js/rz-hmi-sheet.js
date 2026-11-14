/*
 * rz-hmi-sheet.js — draws one HMI sheet (P&ID / SLD / elevation) from data/hmi/drawings/<page>/<sheet>.json
 * (R128 PRD §5–§8, standarization/HMI_DRAWING_STANDARD.md). Shared with the Conventional pages.
 *
 *   var s = RZHmiSheet.render(host, sheet, {
 *     read: function (node) { return { state, alarm, values: { key: {text, alarm} }, rows: [[label, text], …] }; },
 *     open: function (node, sheetApi) {},      // L3 modal
 *     explain: function (node) { return 'one line'; }   // optional tooltip description
 *   });
 *   s.update(); s.trace(nodeId, 'up'|'down'|'both'); s.clearTrace(); s.fit(); s.destroy();
 *
 * Sheet JSON v1: { id, no, title, rev, basis, size:[w,h], nodes:[…], edges:[…], areas:[…], notes:[…] }
 *   node { id, tag, sym, x, y, size?, rot?, cls?, label?, tagAt?, values?:[{k, dx, dy, anchor}], lod?, inst? }
 *   edge { id?, from:'node.port' | [x,y], to:'node.port' | [x,y], via?:[[x,y]…], medium, w?:'main'|'branch'|'signal'|'bus', line?, flowOf? }
 *   area { x, y, w, h, label, kind:'zone'|'box' }   note { x, y, text, role }
 * Geometry is the sheet's; symbols come from RZEngSymbols (one library); every number comes from opts.read.
 * ES5, no dependencies besides RZEngSymbols. Guard: window.RZHmiSheet.
 */
(function (root) {
  'use strict';
  if (!root || root.RZHmiSheet) return;
  var NS = 'http://www.w3.org/2000/svg';
  var doc = root.document;

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function r1(v) { return Math.round(v * 10) / 10; }
  function lib() { return root.RZEngSymbols; }

  /* ── geometry ──────────────────────────────────────────────────────────────────────────────── */
  function portPoint(nodes, ref) {
    if (Array.isArray(ref)) return { x: ref[0], y: ref[1] };
    if (nodes[ref]) return { x: nodes[ref].x, y: nodes[ref].y };         // a junction (or a node by its centre)
    var i = ref.lastIndexOf('.'), n = nodes[ref.slice(0, i)], pn = ref.slice(i + 1);
    if (!n) return null;
    if (n.sym === 'junction') return { x: n.x, y: n.y };
    if (n.box) {
      var bw = n.box[0] / 2, bh = n.box[1] / 2;
      var bp = { top: [n.x, n.y - bh], bottom: [n.x, n.y + bh], left: [n.x - bw, n.y], right: [n.x + bw, n.y] }[pn] ||
        (n.ports && n.ports[pn] ? [n.x + n.ports[pn][0], n.y + n.ports[pn][1]] : null);
      return bp ? { x: bp[0], y: bp[1] } : null;
    }
    var p = lib().ports(n.sym, { x: n.x, y: n.y, size: n.size || 32, rot: n.rot || 0 })[pn];
    return p ? { x: p.x, y: p.y } : null;
  }
  /* orthogonal route: through the via points; between two points that are not aligned, one elbow
     (horizontal first unless the edge says vfirst) */
  function route(a, b, via, vfirst) {
    var pts = [a].concat((via || []).map(function (v) { return { x: v[0], y: v[1] }; })).concat([b]), out = [pts[0]];
    for (var i = 1; i < pts.length; i++) {
      var p = out[out.length - 1], q = pts[i];
      if (Math.abs(p.x - q.x) > 0.01 && Math.abs(p.y - q.y) > 0.01) out.push(vfirst ? { x: p.x, y: q.y } : { x: q.x, y: p.y });
      out.push(q);
    }
    return out;
  }
  function pathD(pts) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + r1(p.x) + ' ' + r1(p.y); }).join(' '); }
  function arrows(pts, cls) {
    var s = '';
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, L = Math.sqrt(dx * dx + dy * dy);
      if (L < 70) continue;
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, ux = dx / L, uy = dy / L, k = 4.5;
      s += '<path class="hmi-arrow ' + cls + '" d="M' + r1(mx + ux * k) + ' ' + r1(my + uy * k) + ' L' + r1(mx - ux * k - uy * k * 0.8) + ' ' +
        r1(my - uy * k + ux * k * 0.8) + ' L' + r1(mx - ux * k + uy * k * 0.8) + ' ' + r1(my - uy * k - ux * k * 0.8) + ' Z"/>';
    }
    return s;
  }
  function longest(pts) {
    var best = null, bl = -1;
    for (var i = 1; i < pts.length; i++) {
      var L = Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
      if (L > bl) { bl = L; best = [pts[i - 1], pts[i]]; }
    }
    return best;
  }

  /* ── tooltip (one per document) ─────────────────────────────────────────────────────────────── */
  var tip = null;
  function tipEl() {
    if (!tip) { tip = doc.createElement('div'); tip.className = 'hmi-tip'; tip.setAttribute('role', 'tooltip'); tip.id = 'hmiTip'; doc.body.appendChild(tip); }
    return tip;
  }
  function showTip(html, x, y) {
    var t = tipEl(); t.innerHTML = html; t.classList.add('is-on');
    var w = t.offsetWidth, h = t.offsetHeight, vw = root.innerWidth, vh = root.innerHeight;
    var left = Math.min(Math.max(8, x + 14), vw - w - 8), top = y + 16 + h > vh - 8 ? y - h - 12 : y + 16;
    t.style.left = left + 'px'; t.style.top = Math.max(8, top) + 'px';
  }
  function hideTip() { if (tip) tip.classList.remove('is-on'); }

  /* ── render ────────────────────────────────────────────────────────────────────────────────── */
  function render(host, sheet, opts) {
    opts = opts || {};
    var L = lib();
    if (!L || !L.use) { host.textContent = 'Symbol library not loaded'; return null; }
    var W = sheet.size[0], H = sheet.size[1], nodes = {}, i;
    sheet.nodes.forEach(function (n) { nodes[n.id] = n; });

    var edgesSvg = '', flowSvg = '', arrowSvg = '', lineSvg = '', nodeSvg = '', textSvg = '', areaSvg = '', graph = [];
    (sheet.areas || []).forEach(function (a) {
      areaSvg += '<rect class="' + (a.kind === 'box' ? 'hmi-box' : 'hmi-zone') + '" x="' + a.x + '" y="' + a.y + '" width="' + a.w + '" height="' + a.h + '"/>';
      if (a.label) areaSvg += '<text class="hmi-area-label" x="' + (a.x + 6) + '" y="' + (a.y + 12) + '">' + esc(a.label) + '</text>';
    });
    function endNode(ref) {
      if (!ref || Array.isArray(ref)) return null;
      if (nodes[ref]) return ref;
      var i = ref.lastIndexOf('.'); return nodes[ref.slice(0, i)] ? ref.slice(0, i) : null;
    }
    sheet.edges.forEach(function (e, k) {
      var a = portPoint(nodes, e.from), b = portPoint(nodes, e.to);
      if (!a || !b) { if (root.console) console.warn('rz-hmi-sheet: unresolved edge', sheet.id, e.from, e.to); return; }
      var pts = route(a, b, e.via, e.vfirst), id = e.id || ('e' + k), m = 'm-' + (e.medium || 'line'), w = 'w-' + (e.w || 'branch');
      edgesSvg += '<path class="hmi-edge ' + m + ' ' + w + '" data-edge="' + esc(id) + '" data-flow="running" d="' + pathD(pts) + '"/>';
      if (e.w !== 'signal' && e.w !== 'inst') {
        flowSvg += '<path class="hmi-edge hmi-flow ' + m + '" data-edge-flow="' + esc(id) + '" data-flow="running" d="' + pathD(pts) + '"/>';
        arrowSvg += '<g data-edge-arrows="' + esc(id) + '">' + arrows(pts, m) + '</g>';
      }
      if (e.line) {
        var seg = longest(pts), horiz = Math.abs(seg[1].y - seg[0].y) < 0.5;
        var lx = (seg[0].x + seg[1].x) / 2, ly = (seg[0].y + seg[1].y) / 2;
        lineSvg += horiz
          ? '<text data-role="line" data-lod="2" x="' + r1(lx) + '" y="' + r1(ly - 4) + '" text-anchor="middle">' + esc(e.line) + '</text>'
          : '<text data-role="line" data-lod="2" transform="translate(' + r1(lx - 4) + ' ' + r1(ly) + ') rotate(-90)" text-anchor="middle">' + esc(e.line) + '</text>';
      }
      graph.push({ id: id, a: endNode(e.from), b: endNode(e.to), flowOf: e.flowOf });
    });
    sheet.nodes.forEach(function (n) {
      if (n.sym === 'junction') { nodeSvg += '<circle class="hmi-junction" data-junction="' + esc(n.id) + '" cx="' + r1(n.x) + '" cy="' + r1(n.y) + '" r="' + (n.dot === false ? 0 : 2.2) + '"/>'; return; }
      if (n.box) { nodeSvg += boxNode(n); return; }
      var sz = n.size || 32, h = sz / 2, label = (n.tag ? n.tag + ' — ' : '') + (n.label || (L.META[n.sym] || {}).label || n.sym);
      nodeSvg += '<g class="hmi-node" data-node="' + esc(n.id) + '" data-sym="' + esc(n.sym) + '"' +
        (n.cls ? ' data-rz-equipment="' + esc(n.cls) + ':' + esc(n.eqId || n.id) + '"' : '') +
        ' tabindex="0" role="button" aria-label="' + esc(label) + '">' +
        '<title>' + esc(label) + '</title>' +
        '<rect class="hmi-hit" x="' + r1(n.x - h - 2) + '" y="' + r1(n.y - h - 2) + '" width="' + (sz + 4) + '" height="' + (sz + 4) + '"/>' +
        L.use(n.sym, { x: n.x, y: n.y, size: sz, rot: n.rot || 0 }) +
        (n.inst ? '<text data-role="inst" x="' + n.x + '" y="' + r1(n.y - sz * 4 / 48 + (n.sym === 'instPanel' ? -1.5 : 2.6)) + '">' + esc(n.inst) + '</text>' : '') +
        '</g>';
      if (n.tag && n.tagAt !== 'none') {
        var at = n.tagAt || 'below', tx = n.x, ty = n.y + h + 10, anchor = 'middle';
        if (at === 'above') ty = n.y - h - 4;
        else if (at === 'right') { tx = n.x + h + 4; ty = n.y + 3; anchor = 'start'; }
        else if (at === 'left') { tx = n.x - h - 4; ty = n.y + 3; anchor = 'end'; }
        if (at === 'belowV') {
          textSvg += '<text data-role="tag" data-tag-of="' + esc(n.id) + '"' + (n.lod ? ' data-lod="' + n.lod + '"' : '') + ' text-anchor="end" transform="translate(' + r1(n.x + 3) + ' ' + r1(n.y + h + 4) + ') rotate(-90)">' + esc(n.tag) + '</text>';
        } else {
          textSvg += '<text data-role="tag" data-tag-of="' + esc(n.id) + '"' + (n.lod ? ' data-lod="' + n.lod + '"' : '') + ' x="' + r1(tx) + '" y="' + r1(ty) + '" text-anchor="' + anchor + '">' + esc(n.tag) + '</text>';
        }
        (n.values || []).forEach(function (v, j) {
          var vx = v.dx != null ? n.x + v.dx : tx, vy = v.dy != null ? n.y + v.dy : ty + 10 * (j + 1);
          textSvg += '<text data-role="value" data-lod="' + (v.lod || 2) + '" data-val="' + esc(n.id) + ':' + esc(v.k) + '" x="' + r1(vx) + '" y="' + r1(vy) + '" text-anchor="' + (v.anchor || anchor) + '">—</text>';
        });
      }
    });
    (sheet.notes || []).forEach(function (t) {
      textSvg += '<text data-role="' + (t.role || 'label') + '" x="' + t.x + '" y="' + t.y + '"' + (t.anchor ? ' text-anchor="' + t.anchor + '"' : '') + (t.lod ? ' data-lod="' + t.lod + '"' : '') + '>' + esc(t.text) + '</text>';
    });
    var tb = sheet.titleblock !== false ? titleBlock(sheet, W, H) : '';

    host.innerHTML = '';
    var frame = doc.createElement('div');
    frame.className = 'hmi-frame';
    frame.setAttribute('data-sheet-frame', sheet.id);
    frame.innerHTML = '<div class="hmi-bar"><span class="hmi-sheet-no">' + esc(sheet.no) + '</span><span class="hmi-title">' + esc(sheet.title) + '</span><span class="hmi-sp"></span>' +
      '<button type="button" class="hmi-btn" data-z="out" aria-label="Zoom out" title="Zoom out">−</button>' +
      '<button type="button" class="hmi-btn" data-z="fit" aria-label="Fit to width" title="Fit to width">Fit</button>' +
      '<button type="button" class="hmi-btn" data-z="in" aria-label="Zoom in" title="Zoom in">+</button></div>' +
      '<svg class="hmi-svg lod-1" xmlns="' + NS + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(sheet.no + ' ' + sheet.title) + '" id="' + esc(sheet.svgId || ('hmi-' + sheet.id)) + '">' +
      '<g class="hmi-areas">' + areaSvg + '</g><g class="hmi-edges">' + edgesSvg + flowSvg + arrowSvg + '</g><g class="hmi-lines">' + lineSvg + '</g>' +
      '<g class="hmi-nodes">' + nodeSvg + '</g><g class="hmi-text">' + textSvg + '</g>' + tb + '</svg>' +
      '<div class="hmi-mini" aria-hidden="true"><svg viewBox="0 0 ' + W + ' ' + H + '"><rect x="0" y="0" width="' + W + '" height="' + H + '" fill="none" stroke="currentColor" stroke-width="4"/><rect class="vp" x="0" y="0" width="' + W + '" height="' + H + '"/></svg></div>';
    host.appendChild(frame);
    var svg = frame.querySelector('svg.hmi-svg'), vpRect = frame.querySelector('.hmi-mini .vp');

    /* ── zoom / pan through the viewBox (fit-to-width at 1×) ───────────────────────────────── */
    var view = { x: 0, y: 0, w: W, h: H, z: 1 };
    function apply() {
      svg.setAttribute('viewBox', r1(view.x) + ' ' + r1(view.y) + ' ' + r1(view.w) + ' ' + r1(view.h));
      svg.classList.toggle('lod-1', view.z < 1.6);
      svg.classList.toggle('lod-2', view.z < 3);
      frame.classList.toggle('is-zoomed', view.z > 1.01);
      vpRect.setAttribute('x', view.x); vpRect.setAttribute('y', view.y); vpRect.setAttribute('width', view.w); vpRect.setAttribute('height', view.h);
    }
    function zoomAt(f, cx, cy) {
      var z = Math.max(1, Math.min(6, view.z * f));
      if (z === view.z) return;
      var nw = W / z, nh = H / z;
      cx = cx == null ? view.x + view.w / 2 : cx; cy = cy == null ? view.y + view.h / 2 : cy;
      view.x = Math.max(0, Math.min(W - nw, cx - (cx - view.x) * (nw / view.w)));
      view.y = Math.max(0, Math.min(H - nh, cy - (cy - view.y) * (nh / view.h)));
      view.w = nw; view.h = nh; view.z = z; apply();
    }
    function fit() { view = { x: 0, y: 0, w: W, h: H, z: 1 }; apply(); }
    function toSheet(ev) {
      var r = svg.getBoundingClientRect();
      return { x: view.x + (ev.clientX - r.left) / r.width * view.w, y: view.y + (ev.clientY - r.top) / r.height * view.h };
    }
    frame.querySelector('.hmi-bar').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-z]'); if (!b) return;
      var z = b.getAttribute('data-z');
      if (z === 'fit') fit(); else zoomAt(z === 'in' ? 1.5 : 1 / 1.5);
    });
    svg.addEventListener('wheel', function (ev) {
      if (!ev.ctrlKey && view.z === 1 && !ev.altKey) return;      // a plain wheel scrolls the page at 1×
      ev.preventDefault();
      var p = toSheet(ev); zoomAt(ev.deltaY < 0 ? 1.2 : 1 / 1.2, p.x, p.y);
    }, { passive: false });
    var drag = null;
    svg.addEventListener('pointerdown', function (ev) {
      if (view.z <= 1.001 || ev.button !== 0) return;
      drag = { x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y, moved: false };
    });
    root.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      var r = svg.getBoundingClientRect(), dx = (ev.clientX - drag.x) / r.width * view.w, dy = (ev.clientY - drag.y) / r.height * view.h;
      if (Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y) > 4) { drag.moved = true; frame.classList.add('is-panning'); }
      view.x = Math.max(0, Math.min(W - view.w, drag.vx - dx)); view.y = Math.max(0, Math.min(H - view.h, drag.vy - dy)); apply();
    });
    root.addEventListener('pointerup', function () { if (drag) { frame.classList.remove('is-panning'); setTimeout(function () { drag = null; }, 0); } });

    /* ── tooltip + open ───────────────────────────────────────────────────────────────────── */
    function nodeOf(el) { var g = el && el.closest && el.closest('.hmi-node'); return g ? nodes[g.getAttribute('data-node')] : null; }
    function tipHtml(n) {
      var d = opts.read ? opts.read(n) || {} : {}, meta = L.META[n.sym] || {}, rows = '';
      (d.rows || []).forEach(function (r) { rows += '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; });
      return '<div class="k">' + esc(n.tag || n.id) + '</div><div>' + esc(n.label || meta.label || n.sym) + '</div>' +
        '<div class="s">' + esc(meta.label || '') + (L.STANDARD && L.STANDARD[n.sym] ? ' · ' + esc(L.STANDARD[n.sym]) : '') + '</div>' +
        (d.state ? '<div class="s">State: ' + esc(d.state) + '</div>' : '') +
        (opts.explain && opts.explain(n) ? '<div class="s">' + esc(opts.explain(n)) + '</div>' : '') +
        (rows ? '<table>' + rows + '</table>' : '') + (n.cls && opts.open ? '<div class="hint">Click for the equipment schematic</div>' : '');
    }
    var tipTimer = null;
    svg.addEventListener('pointerover', function (ev) {
      var n = nodeOf(ev.target); if (!n) return;
      clearTimeout(tipTimer);
      tipTimer = setTimeout(function () { showTip(tipHtml(n), ev.clientX, ev.clientY); }, 250);
    });
    svg.addEventListener('pointerout', function (ev) { if (nodeOf(ev.target)) { clearTimeout(tipTimer); hideTip(); } });
    svg.addEventListener('focusin', function (ev) {
      var n = nodeOf(ev.target); if (!n) return;
      var r = ev.target.getBoundingClientRect(); showTip(tipHtml(n), r.right, r.top);
    });
    svg.addEventListener('focusout', hideTip);
    function openNode(n, el) {
      if (!n || !opts.open) return;
      hideTip();
      svg.querySelectorAll('.hmi-node.is-selected').forEach(function (g) { g.classList.remove('is-selected'); });
      if (el) el.classList.add('is-selected');
      opts.open(n, api, el);
    }
    svg.addEventListener('click', function (ev) {
      if (drag && drag.moved) return;
      var g = ev.target.closest && ev.target.closest('.hmi-node'); if (g) openNode(nodes[g.getAttribute('data-node')], g);
    });
    svg.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var g = ev.target.closest && ev.target.closest('.hmi-node'); if (!g) return;
      ev.preventDefault(); openNode(nodes[g.getAttribute('data-node')], g);
    });

    /* ── live values + states ─────────────────────────────────────────────────────────────── */
    function update() {
      if (!opts.read) return;
      sheet.nodes.forEach(function (n) {
        var d = opts.read(n) || {}, g = svg.querySelector('.hmi-node[data-node="' + n.id + '"]');
        if (!g) return;
        var sym = g.querySelector('[data-sym]');
        if (d.state) { g.setAttribute('data-state', d.state); if (sym) sym.setAttribute('data-state', d.state); }
        if (d.alarm) g.setAttribute('data-alarm', d.alarm); else g.removeAttribute('data-alarm');
        (n.values || []).forEach(function (v) {
          var t = svg.querySelector('[data-val="' + n.id + ':' + v.k + '"]'), dv = d.values && d.values[v.k];
          if (!t) return;
          t.textContent = dv ? dv.text : '—';
          if (dv && dv.alarm) t.setAttribute('data-alarm', dv.alarm); else t.removeAttribute('data-alarm');
        });
      });
      graph.forEach(function (e) {
        if (!e.flowOf && !opts.flow) return;
        var f = opts.flow ? opts.flow(e) : null;
        if (!f) return;
        svg.querySelectorAll('[data-edge="' + e.id + '"], [data-edge-flow="' + e.id + '"]').forEach(function (p) { p.setAttribute('data-flow', f); });
        var ar = svg.querySelector('[data-edge-arrows="' + e.id + '"]'); if (ar) ar.style.display = f === 'running' ? '' : 'none';
      });
    }

    /* ── trace: follow the edges from a node, in flow direction (down) or against it (up) ─── */
    function trace(id, dir) {
      clearTrace();
      var seen = {}, edges = {}, q = [id];
      seen[id] = 1;
      while (q.length) {
        var cur = q.shift();
        graph.forEach(function (e) {
          var nxt = null;
          if ((dir === 'down' || dir === 'both') && e.a === cur) nxt = e.b;
          if ((dir === 'up' || dir === 'both') && e.b === cur) nxt = e.a;
          if (nxt === null) return;
          edges[e.id] = 1;
          if (nxt && !seen[nxt]) { seen[nxt] = 1; q.push(nxt); }
        });
      }
      Object.keys(edges).forEach(function (eid) { svg.querySelectorAll('[data-edge="' + eid + '"]').forEach(function (p) { p.classList.add('is-traced'); }); });
      Object.keys(seen).forEach(function (nid) { var g = svg.querySelector('.hmi-node[data-node="' + nid + '"]'); if (g) g.classList.add('is-traced'); });
      return { nodes: Object.keys(seen), edges: Object.keys(edges) };
    }
    function clearTrace() { svg.querySelectorAll('.is-traced').forEach(function (e) { e.classList.remove('is-traced'); }); }
    function focusNode(id) {
      var n = nodes[id]; if (!n) return;
      if (view.z < 2) zoomAt(2.5 / view.z, n.x, n.y);
      var w = view.w, h = view.h;
      view.x = Math.max(0, Math.min(W - w, n.x - w / 2)); view.y = Math.max(0, Math.min(H - h, n.y - h / 2)); apply();
    }

    var api = { sheet: sheet, svg: svg, frame: frame, update: update, trace: trace, clearTrace: clearTrace, fit: fit, zoom: zoomAt, focus: focusNode,
      node: function (id) { return nodes[id]; }, graph: graph, destroy: function () { host.innerHTML = ''; hideTip(); } };
    apply();
    update();
    return api;
  }

  /* a drawn item that is a rectangle in the drawing (rack slot, board, tray) rather than a symbol */
  function boxNode(n) {
    var w = n.box[0], h = n.box[1], x = n.x - w / 2, y = n.y - h / 2, label = (n.tag ? n.tag + ' — ' : '') + (n.label || '');
    var marks = (n.marks || []).map(function (m) {
      return '<rect class="hmi-slot" x="' + r1(x + m[0]) + '" y="' + r1(y + m[1]) + '" width="' + m[2] + '" height="' + m[3] + '"/>';
    }).join('');
    return '<g class="hmi-node" data-node="' + esc(n.id) + '" data-sym="' + esc(n.boxSym || 'box') + '"' +
      (n.cls ? ' data-rz-equipment="' + esc(n.cls) + ':' + esc(n.eqId || n.id) + '"' : '') +
      ' tabindex="0" role="button" aria-label="' + esc(label) + '"' + (n.lod ? ' data-lod="' + n.lod + '"' : '') + '>' +
      '<title>' + esc(label) + '</title><g data-sym="' + esc(n.boxSym || 'box') + '"><rect class="b" x="' + r1(x) + '" y="' + r1(y) + '" width="' + w + '" height="' + h +
      '" fill="none" stroke="currentColor" stroke-width="1"/>' + marks + '</g>' +
      (n.text ? '<text data-role="' + (n.textRole || 'label') + '" x="' + r1(x + 4) + '" y="' + r1(y + h / 2 + 3.2) + '">' + esc(n.text) + '</text>' : '') +
      '</g>';
  }

  function titleBlock(s, W, H) {
    var w = 250, h = 54, x = W - w - 6, y = H - h - 6;
    return '<g data-role="titleblock" transform="translate(' + x + ' ' + y + ')">' +
      '<rect x="0" y="0" width="' + w + '" height="' + h + '"/><line x1="0" y1="20" x2="' + w + '" y2="20"/><line x1="0" y1="37" x2="' + w + '" y2="37"/>' +
      '<line x1="96" y1="20" x2="96" y2="' + h + '"/><line x1="170" y1="20" x2="170" y2="' + h + '"/>' +
      '<text class="t" x="6" y="14">' + esc(s.title) + '</text>' +
      '<text x="6" y="32">' + esc(s.no) + '</text><text x="102" y="32">REV ' + esc(s.rev || 'A') + '</text><text x="176" y="32">SHEET ' + esc(s.sheet || '1/1') + '</text>' +
      '<text x="6" y="49">' + esc(s.basis || '') + '</text><text x="102" y="49">SCALE NTS</text><text x="176" y="49">STATUS SIM</text></g>';
  }

  root.RZHmiSheet = { render: render, version: '1.0.0' };
})(typeof window !== 'undefined' ? window : null);
