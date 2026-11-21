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
 *   node { id, tag, sym, x, y, size?, rot?, cls?, label?, tagAt? ('above'|'below'|'left'|'right'|'belowV'|'none'|'at' + tagXY:[dx,dy,anchor]), values?:[{k, dx, dy, anchor, point?, label?, unit?}], lod?, inst? }
 *     value.point = a point id (PRD-CONV-POINT-STATUS-TREND): the label is coloured by RZPointStatus and opens its trend
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

  /* ── shading (owner R139/R140 "deep shader"): one shared <defs> block per document, referenced by CSS ───
   * Everything the deep mode paints lives here under the ids hmi-g-* (gradients) and hmi-f-* (filters), so the
   * paint gate can tell the renderer's own shading from stray decoration. Flat mode (ISA-101 strict) is one
   * attribute away: data-shade="flat" on the frame; the choice persists in localStorage rz_hmi_shade. */
  var SHADE_KEY = 'rz_hmi_shade';
  function shadeMode() { try { return root.localStorage.getItem(SHADE_KEY) === 'flat' ? 'flat' : 'deep'; } catch (e) { return 'deep'; } }
  function setShadeMode(m) {
    try { root.localStorage.setItem(SHADE_KEY, m); } catch (e) { /* no storage */ }
    var fr = doc.querySelectorAll('.hmi-frame'); for (var i = 0; i < fr.length; i++) { fr[i].setAttribute('data-shade', m); var b = fr[i].querySelector('[data-shade-btn]'); if (b) b.setAttribute('aria-pressed', m === 'deep' ? 'true' : 'false'); }
  }
  function ensureDefs() {
    if (doc.getElementById('hmi-g-run')) return;
    var grad = function (id, k) {
      return '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1" class="hmi-g hmi-g-' + k + '"><stop offset="0" class="s0"/><stop offset=".55" class="s1"/><stop offset="1" class="s2"/></linearGradient>';
    };
    var d = doc.createElementNS(NS, 'svg');
    d.setAttribute('class', 'hmi-defs'); d.setAttribute('aria-hidden', 'true'); d.setAttribute('width', '0'); d.setAttribute('height', '0');
    d.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
    d.innerHTML = '<defs>' + grad('hmi-g-run', 'run') + grad('hmi-g-run2', 'run2') + grad('hmi-g-off', 'off') + grad('hmi-g-panel', 'panel') + grad('hmi-g-zone', 'zone') +
      '<linearGradient id="hmi-g-canvas" x1="0" y1="0" x2="0" y2="1" class="hmi-g hmi-g-canvas"><stop offset="0" class="s0"/><stop offset="1" class="s2"/></linearGradient>' +
      '<filter id="hmi-f-soft" x="-20%" y="-20%" width="140%" height="160%" color-interpolation-filters="sRGB"><feDropShadow dx="0" dy="1" stdDeviation="1.1" flood-color="#000" flood-opacity=".42"/></filter>' +
      '<filter id="hmi-f-lift" x="-10%" y="-10%" width="120%" height="130%" color-interpolation-filters="sRGB"><feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-color="#000" flood-opacity=".35"/></filter>' +
      '<filter id="hmi-f-glow" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB"><feDropShadow dx="0" dy="0" stdDeviation="2.4" flood-color="currentColor" flood-opacity=".55"/></filter></defs>';
    doc.body.insertBefore(d, doc.body.firstChild);
  }
  /* a symbol without a body class gets one on its first shape, so the shading and the running fill have something to paint */
  function withBody(markup) {
    if (/class="b"/.test(markup)) return markup;
    return markup.replace(/<(circle|rect|path|ellipse|polygon)\b/, '<$1 class="b"');
  }

  /* ── render ────────────────────────────────────────────────────────────────────────────────── */
  function render(host, sheet, opts) {
    ensureDefs();
    opts = opts || {};
    var L = lib();
    if (!L || !L.use) { host.textContent = 'Symbol library not loaded'; return null; }
    var W = sheet.size[0], H = sheet.size[1], nodes = {}, i;
    sheet.nodes.forEach(function (n) { nodes[n.id] = n; });

    var edgesSvg = '', flowSvg = '', arrowSvg = '', lineSvg = '', nodeSvg = '', textSvg = '', areaSvg = '', graph = [], shadowSvg = '', hiSvg = '';
    (sheet.areas || []).forEach(function (a) {
      areaSvg += '<rect class="' + (a.kind === 'box' ? 'hmi-box' : 'hmi-zone') + '" x="' + a.x + '" y="' + a.y + '" width="' + a.w + '" height="' + a.h + '"/>';
      if (a.label) areaSvg += '<text class="hmi-area-label" data-role="tag" x="' + (a.x + 6) + '" y="' + (a.y + 12) + '">' + esc(a.label) + '</text>';
    });
    function endNode(ref) {
      if (!ref || Array.isArray(ref)) return null;
      if (nodes[ref]) return ref;
      var i = ref.lastIndexOf('.'); return nodes[ref.slice(0, i)] ? ref.slice(0, i) : null;
    }
    /* R147: symbol bodies are obstacles for the RZ diagram engine (js/rz-diagram-layout.js) — an edge without via
       points that would cross another symbol is re-routed orthogonally around it; box nodes (zones, slots, racks) are
       containers lines may pass through, so they are not obstacles. Without the engine the one-elbow route stands. */
    var LAY = root.RZDiagramLayout, obstacles = [];
    if (LAY && LAY.route && LAY.segmentHitsRect) sheet.nodes.forEach(function (n) {
      if (n.sym === 'junction' || n.box) return;
      var sz = n.size || 32; obstacles.push({ id: n.id, x: n.x - sz / 2 - 1, y: n.y - sz / 2 - 1, w: sz + 2, h: sz + 2 });
    });
    function hits(pts, obs) {
      for (var i = 1; i < pts.length; i++) for (var j = 0; j < obs.length; j++) if (LAY.segmentHitsRect({ x1: pts[i - 1].x, y1: pts[i - 1].y, x2: pts[i].x, y2: pts[i].y }, obs[j])) return true;
      return false;
    }
    sheet.edges.forEach(function (e, k) {
      var a = portPoint(nodes, e.from), b = portPoint(nodes, e.to);
      if (!a || !b) { if (root.console) console.warn('rz-hmi-sheet: unresolved edge', sheet.id, e.from, e.to); return; }
      var pts = route(a, b, e.via, e.vfirst), id = e.id || ('e' + k), m = 'm-' + (e.medium || 'line'), w = 'w-' + (e.w || 'branch'), routed = '';
      var na = endNode(e.from), nb = endNode(e.to);
      if (obstacles.length && !(e.via && e.via.length) && Math.abs(a.x - b.x) > 0.01 && Math.abs(a.y - b.y) > 0.01) {
        var obs = obstacles.filter(function (o) { return o.id !== na && o.id !== nb; });
        if (hits(pts, obs)) { var rr = LAY.route(a, b, { obstacles: obs, clearance: 8, radius: 0 }); if (rr && !rr.transit) { pts = rr.points; routed = ' data-routed="1"'; } }
      }
      var dAttr = pathD(pts);
      if (e.w !== 'signal' && e.w !== 'inst') shadowSvg += '<path class="hmi-edge-shadow ' + w + '" data-edge-shadow="' + esc(id) + '" d="' + dAttr + '"/>';
      edgesSvg += '<path class="hmi-edge ' + m + ' ' + w + '" data-edge="' + esc(id) + '" data-ends="' + esc((na || '') + '|' + (nb || '')) + '"' + routed + ' data-flow="running" d="' + dAttr + '"/>';
      if (e.w !== 'signal' && e.w !== 'inst') {
        hiSvg += '<path class="hmi-edge-hi ' + w + '" data-edge-hi="' + esc(id) + '" d="' + dAttr + '"/>';
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
      graph.push({ id: id, a: endNode(e.from), b: endNode(e.to), flowOf: e.flowOf, m: e.medium || 'line', w: e.w || 'branch' });
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
        withBody(L.use(n.sym, { x: n.x, y: n.y, size: sz, rot: n.rot || 0 })) +
        (n.inst ? '<text data-role="inst" x="' + n.x + '" y="' + r1(n.y - sz * 4 / 48 + (n.sym === 'instPanel' ? -1.5 : 2.6)) + '">' + esc(n.inst) + '</text>' : '') +
        '</g>';
      if (n.tag && n.tagAt !== 'none') {
        var at = n.tagAt || 'below', tx = n.x, ty = n.y + h + 10, anchor = 'middle';
        if (at === 'above') ty = n.y - h - 4;
        else if (at === 'right') { tx = n.x + h + 4; ty = n.y + 3; anchor = 'start'; }
        else if (at === 'left') { tx = n.x - h - 4; ty = n.y + 3; anchor = 'end'; }
        /* tagAt 'at' + tagXY [dx, dy, anchor]: the tag at an explicit offset from the symbol centre (a compact drawing
           such as an equipment's internal sheet, where above/below/left/right would sit on a pipe) */
        if (at === 'at' && n.tagXY) { tx = n.x + n.tagXY[0]; ty = n.y + n.tagXY[1]; anchor = n.tagXY[2] || 'middle'; }
        if (at === 'belowV') {
          textSvg += '<text data-role="tag" data-tag-of="' + esc(n.id) + '"' + (n.lod ? ' data-lod="' + n.lod + '"' : '') + ' text-anchor="end" transform="translate(' + r1(n.x + 3) + ' ' + r1(n.y + h + 4) + ') rotate(-90)">' + esc(n.tag) + '</text>';
        } else {
          textSvg += '<text data-role="tag" data-tag-of="' + esc(n.id) + '"' + (n.lod ? ' data-lod="' + n.lod + '"' : '') + ' x="' + r1(tx) + '" y="' + r1(ty) + '" text-anchor="' + anchor + '">' + esc(n.tag) + '</text>';
          /* R149: the equipment name (short, upper case) and its rating sit under the tag — a reader finds the CRAH, the
             chiller, the CDU by name, not by guessing from a symbol */
          var step = at === 'above' ? -12 : 12, ly = ty;   // 12: a 10 px tag over a 9 px name must not share a pixel row (geometry gate G1)
          if (n.name) { ly += step; textSvg += '<text data-role="name" data-name-of="' + esc(n.id) + '"' + (n.lod ? ' data-lod="' + n.lod + '"' : '') + ' x="' + r1(tx) + '" y="' + r1(ly) + '" text-anchor="' + anchor + '">' + esc(n.name) + '</text>'; }
          if (n.rating) { ly += step; textSvg += '<text data-role="value" data-rating-of="' + esc(n.id) + '" x="' + r1(tx) + '" y="' + r1(ly) + '" text-anchor="' + anchor + '">' + esc(n.rating) + '</text>'; }
          if (n.values && n.values.length && (n.name || n.rating)) ty = ly;
        }
        (n.values || []).forEach(function (v, j) {
          var vx = v.dx != null ? n.x + v.dx : tx, vy = v.dy != null ? n.y + v.dy : ty + 10 * (j + 1);
          /* a value item with `point` is a point (PRD-CONV-POINT-STATUS-TREND T2): its id, name and unit ride on the label;
             data-point itself is written by update() once the label first shows a number (js/conv/point-status.js) */
          var pa = v.point ? ' data-pt-id="' + esc(v.point) + '"' + (v.label ? ' data-pt-label="' + esc(v.label) + '"' : '') + (v.unit ? ' data-pt-unit="' + esc(v.unit) + '"' : '') : '';
          textSvg += '<text data-role="value" data-lod="' + (v.lod || 2) + '" data-val="' + esc(n.id) + ':' + esc(v.k) + '"' + pa + ' x="' + r1(vx) + '" y="' + r1(vy) + '" text-anchor="' + (v.anchor || anchor) + '">—</text>';
        });
      }
    });
    (sheet.notes || []).forEach(function (t) {
      textSvg += '<text data-role="' + (t.role || 'label') + '" x="' + t.x + '" y="' + t.y + '"' + (t.anchor ? ' text-anchor="' + t.anchor + '"' : '') + (t.lod ? ' data-lod="' + t.lod + '"' : '') + '>' + esc(t.text) + '</text>';
    });
    // R149 loop legend: one stroke sample per medium with its loop name (FWS vs TCS vs CHW ...), top-right of the sheet
    var lg = '';
    (sheet.legend || []).forEach(function (it, i) {
      var at = sheet.legendAt || [W - 200, 16], cols = sheet.legendCols || 1, per = Math.ceil(sheet.legend.length / cols);
      var lx = at[0] + Math.floor(i / per) * 210, ly = at[1] + (i % per) * 14;
      lg += '<path class="hmi-edge m-' + esc(it[0]) + ' w-main" d="M' + lx + ' ' + ly + ' L' + (lx + 26) + ' ' + ly + '"/>' +
        '<text data-role="legend" x="' + (lx + 32) + '" y="' + (ly + 3) + '">' + esc(it[1]) + '</text>';
    });
    if (lg) lg = '<g class="hmi-legend">' + lg + '</g>';
    var tb = (sheet.titleblock === true ? titleBlock(sheet, W, H) : '') + lg;   // R144: PME/BMS screens carry no title block; the bar holds no + title

    host.innerHTML = '';
    var frame = doc.createElement('div');
    frame.className = 'hmi-frame';
    frame.setAttribute('data-sheet-frame', sheet.id);
    frame.setAttribute('data-shade', shadeMode());
    /* equipment finder (owner brief O9): every item with a payload by tag and name — on a phone the fitted sheet is too
       small to tap, so choosing an item zooms to it, marks it selected and moves focus there */
    var findable = sheet.nodes.filter(function (n) { return n.cls && n.tag && n.sym !== 'junction'; });
    var findOpts = findable.map(function (n) { return '<option value="' + esc(n.id) + '">' + esc(n.tag + (n.name ? ' · ' + n.name : '')) + '</option>'; }).join('');
    frame.innerHTML = '<div class="hmi-bar"><span class="hmi-sheet-no">' + esc(sheet.no) + '</span><span class="hmi-title">' + esc(sheet.title) + '</span><span class="hmi-sp"></span>' +
      (findable.length ? '<select class="hmi-find" data-find aria-label="Find equipment on ' + esc(sheet.no) + '"><option value="">Find…</option>' + findOpts + '</select>' : '') +
      '<button type="button" class="hmi-btn" data-z="out" aria-label="Zoom out" title="Zoom out">−</button>' +
      '<button type="button" class="hmi-btn" data-z="fit" aria-label="Fit to width" title="Fit to width">Fit</button>' +
      '<button type="button" class="hmi-btn" data-z="in" aria-label="Zoom in" title="Zoom in">+</button>' +
      '<button type="button" class="hmi-btn hmi-btn-shade" data-shade-btn aria-pressed="' + (shadeMode() === 'deep' ? 'true' : 'false') + '" aria-label="Shaded drawing (off = flat ISA-101 line work)" title="Shaded drawing (off = flat ISA-101 line work)">Shade</button></div>' +
      '<div class="hmi-vp" style="--hmi-min-w:' + Math.round(W * (sheet.minScale || 0.9)) + 'px">' +
      '<svg class="hmi-svg lod-1" xmlns="' + NS + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(sheet.no + ' ' + sheet.title) + '" id="' + esc(sheet.svgId || ('hmi-' + sheet.id)) + '"' +
        ' data-rz-authored-basis="' + esc('HMI sheet ' + sheet.no + ': counts, ratings and design temperatures come from the DC AI engine snapshot (' + (sheet.basis || 'engine') + ') through js/datahall-ai/hmi-sheets.js; live values and states from the equipment payload (hmi-payloads.js)') + '">' +
      '<rect class="hmi-canvas" x="0" y="0" width="' + W + '" height="' + H + '"/><g class="hmi-areas">' + areaSvg + '</g><g class="hmi-edges"><g class="hmi-edge-shadows">' + shadowSvg + '</g>' + edgesSvg + '<g class="hmi-edge-his">' + hiSvg + '</g>' + flowSvg + arrowSvg + '</g><g class="hmi-lines">' + lineSvg + '</g>' +
      '<g class="hmi-nodes">' + nodeSvg + '</g><g class="hmi-text">' + textSvg + '</g>' + tb + '</svg>' + '</div>' +
      '<div class="hmi-mini" aria-hidden="true"><svg viewBox="0 0 ' + W + ' ' + H + '"><rect x="0" y="0" width="' + W + '" height="' + H + '" fill="none" stroke="currentColor" stroke-width="4"/><rect class="vp" x="0" y="0" width="' + W + '" height="' + H + '"/></svg></div>';
    host.appendChild(frame);
    var svg = frame.querySelector('svg.hmi-svg'), vpRect = frame.querySelector('.hmi-mini .vp');

    /* ── zoom / pan through the viewBox (fit-to-width at 1×) ───────────────────────────────── */
    var view = { x: 0, y: 0, w: W, h: H, z: 1 };
    /* while the view moves, the shading layers (filters, tube shadows / crests) are dropped and come back 180 ms after it
       stops: a zoom or pan re-rasterises the sheet every frame, and shadows are the first cost to shed (owner brief) */
    /* during a gesture the drawn sheet is moved by a GPU transform (no re-raster per frame, like a map viewer); the real
       viewBox — and sharp text, LOD and shading — is committed when the view settles. Without a laid-out SVG (hidden tab)
       the viewBox is committed at once. */
    var movingT = null, applied = 0, committed = { x: 0, y: 0, w: W, h: H };
    function commit() {
      clearTimeout(movingT); movingT = null;
      svg.style.transform = ''; svg.style.transformOrigin = '';
      svg.setAttribute('viewBox', r1(view.x) + ' ' + r1(view.y) + ' ' + r1(view.w) + ' ' + r1(view.h));
      committed = { x: view.x, y: view.y, w: view.w, h: view.h };
      svg.classList.toggle('lod-1', view.z < 1.6);
      svg.classList.toggle('lod-2', view.z < 3);
      frame.removeAttribute('data-moving');
    }
    function apply() {
      frame.classList.toggle('is-zoomed', view.z > 1.01);
      vpRect.setAttribute('x', view.x); vpRect.setAttribute('y', view.y); vpRect.setAttribute('width', view.w); vpRect.setAttribute('height', view.h);
      var px = svg.clientWidth;
      if (!applied++ || !px) { commit(); return; }
      var sc = committed.w / view.w, k = px / committed.w;
      svg.style.transformOrigin = '0 0';
      svg.style.transform = 'translate(' + r1(-sc * k * (view.x - committed.x)) + 'px,' + r1(-sc * k * (view.y - committed.y)) + 'px) scale(' + sc.toFixed(4) + ')';
      frame.setAttribute('data-moving', '');
      clearTimeout(movingT); movingT = setTimeout(commit, 180);
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
      var sb = ev.target.closest('[data-shade-btn]'); if (sb) { setShadeMode(sb.getAttribute('aria-pressed') === 'true' ? 'flat' : 'deep'); return; }
      var b = ev.target.closest('[data-z]'); if (!b) return;
      var z = b.getAttribute('data-z');
      if (z === 'fit') fit(); else zoomAt(z === 'in' ? 1.5 : 1 / 1.5);
      commit();   // a button is one discrete step, not a gesture: its viewBox holds at once (conv B5 reads it right after the click)
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
    function onPanMove(ev) {
      if (!drag) return;
      var r = svg.getBoundingClientRect(), dx = (ev.clientX - drag.x) / r.width * view.w, dy = (ev.clientY - drag.y) / r.height * view.h;
      if (Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y) > 4) { drag.moved = true; frame.classList.add('is-panning'); }
      view.x = Math.max(0, Math.min(W - view.w, drag.vx - dx)); view.y = Math.max(0, Math.min(H - view.h, drag.vy - dy)); apply();
    }
    function onPanEnd() { if (drag) { frame.classList.remove('is-panning'); setTimeout(function () { drag = null; }, 0); } }
    /* On window so a pan survives the pointer leaving the sheet; destroy() removes both (a closed modal kept its
       whole drawing alive through them, v3.63.3). */
    root.addEventListener('pointermove', onPanMove);
    root.addEventListener('pointerup', onPanEnd);

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
      tipTimer = setTimeout(function () { if (svg.isConnected) showTip(tipHtml(n), ev.clientX, ev.clientY); }, 250);
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
    /* element lookups cached once (a repaint of ~600 nodes did ~600 attribute-selector scans); attributes written only
       when they change, so an unchanged repaint triggers no style recalculation */
    var elCache = null;
    function els() {
      if (elCache) return elCache;
      elCache = { node: {}, val: {}, edge: {}, arrows: {} };
      svg.querySelectorAll('.hmi-node[data-node]').forEach(function (g) { elCache.node[g.getAttribute('data-node')] = g; });
      svg.querySelectorAll('[data-val]').forEach(function (t) { elCache.val[t.getAttribute('data-val')] = t; });
      svg.querySelectorAll('[data-edge], [data-edge-flow]').forEach(function (p) { var k = p.getAttribute('data-edge') || p.getAttribute('data-edge-flow'); (elCache.edge[k] = elCache.edge[k] || []).push(p); });
      svg.querySelectorAll('[data-edge-arrows]').forEach(function (a) { elCache.arrows[a.getAttribute('data-edge-arrows')] = a; });
      return elCache;
    }
    function setA(el, k, v) { if (v == null || v === false) { if (el.hasAttribute(k)) el.removeAttribute(k); } else if (el.getAttribute(k) !== String(v)) el.setAttribute(k, v); }
    function update() {
      if (!opts.read) return;
      var E = els(), PS = root.RZPointStatus, unbound = false;
      sheet.nodes.forEach(function (n) {
        var d = opts.read(n) || {}, g = E.node[n.id];
        if (!g || g.__d === d) return;   // the same reading object as the last repaint: nothing on this node can have changed
        g.__d = d;
        var sym = g.__sym || (g.__sym = g.querySelector('[data-sym]'));
        if (d.state) { setA(g, 'data-state', d.state); if (sym) setA(sym, 'data-state', d.state); }
        setA(g, 'data-quality', d.quality || null);
        setA(g, 'data-alarm', d.alarm || null);
        /* alarm without colour (owner brief O5): a priority badge — diamond with the ISA priority digit — top-right of the
           symbol; hollow once acknowledged; it stays while the source is active */
        var bd = g.__bd && g.__bd.parentNode === g ? g.__bd : null;
        if (d.alarm) {
          if (!bd) {
            var sz = n.box ? Math.max(n.box[0], n.box[1]) : (n.size || 32), bx = n.box ? n.x + n.box[0] / 2 : n.x + sz / 2, by = n.box ? n.y - n.box[1] / 2 : n.y - sz / 2;
            bd = document.createElementNS(NS, 'g'); bd.setAttribute('class', 'hmi-alarm-badge'); bd.setAttribute('transform', 'translate(' + r1(bx) + ' ' + r1(by) + ')');
            bd.innerHTML = '<path d="M0 -8 L8 0 L0 8 L-8 0 Z"/><text x="0" y="3.2" text-anchor="middle"></text>';
            g.appendChild(bd); g.__bd = bd;
          }
          bd.setAttribute('data-prio', d.alarm); bd.setAttribute('data-ack', d.ack ? '1' : '0'); bd.querySelector('text').textContent = d.alarm;
        } else if (bd) { bd.remove(); g.__bd = null; }
        (n.values || []).forEach(function (v) {
          var t = E.val[n.id + ':' + v.k], dv = d.values && d.values[v.k];
          if (!t) return;
          var tx = dv ? dv.text : '—', pid = t.getAttribute('data-pt-id');
          if (!pid) { if (t.textContent !== tx) t.textContent = tx; }
          else if (t.__tx !== tx) {
            /* a point keeps its glyph tspan: only the text node is rewritten, and the state only when the text changed */
            t.__tx = tx;
            var tn = t.firstChild; if (tn && tn.nodeType === 3) tn.nodeValue = tx; else t.insertBefore(doc.createTextNode(tx), t.firstChild);
            if (PS) {
              if (t.hasAttribute('data-point')) PS.apply(t, pid);
              else if (/\d/.test(tx)) { t.setAttribute('data-point', pid); unbound = true; }
            }
          }
          setA(t, 'data-alarm', dv && dv.alarm ? dv.alarm : null);
        });
      });
      if (unbound) PS.bindAll(svg);   /* registers the new points with RZTrend, makes them buttons, applies their state */
      graph.forEach(function (e) {
        if (!e.flowOf && !opts.flow) return;
        var f = opts.flow ? opts.flow(e, graph) : null;
        if (!f) return;
        (E.edge[e.id] || []).forEach(function (p) { setA(p, 'data-flow', f); });
        var ar = E.arrows[e.id], disp = f === 'running' ? '' : 'none'; if (ar && ar.style.display !== disp) ar.style.display = disp;
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
      view.x = Math.max(0, Math.min(W - w, n.x - w / 2)); view.y = Math.max(0, Math.min(H - h, n.y - h / 2)); apply(); commit();
      // on a narrow frame the sheet scrolls inside its viewport: bring the item's column into view there too
      var vp = svg.parentElement, px = svg.clientWidth;
      if (vp && px && vp.scrollWidth > vp.clientWidth + 1) vp.scrollLeft = Math.max(0, (n.x - view.x) / view.w * px - vp.clientWidth / 2);
    }

    /* bring an item to the middle of the frame without zooming: on a phone a sheet is wider than its viewport and
       opens at its left edge, so the item that was opened could sit half outside it (v3.65.3) */
    function centerNode(id) {
      var n = nodes[id], vp = svg.parentElement; if (!n || !vp) return;
      var px = svg.clientWidth, py = svg.clientHeight;
      if (px && vp.scrollWidth > vp.clientWidth + 1) vp.scrollLeft = Math.max(0, (n.x - view.x) / view.w * px - vp.clientWidth / 2);
      if (py && vp.scrollHeight > vp.clientHeight + 1) vp.scrollTop = Math.max(0, (n.y - view.y) / view.h * py - vp.clientHeight / 2);
    }

    var fsel = frame.querySelector('[data-find]');
    if (fsel) fsel.addEventListener('change', function () {
      var id = fsel.value; if (!id) return;
      svg.querySelectorAll('.hmi-node[data-selected]').forEach(function (g) { g.removeAttribute('data-selected'); });
      focusNode(id);
      var g = svg.querySelector('.hmi-node[data-node="' + id.replace(/"/g, '') + '"]');
      if (g) { g.setAttribute('data-selected', ''); g.focus({ preventScroll: true }); }
    });
    var api = { sheet: sheet, svg: svg, frame: frame, update: update, trace: trace, clearTrace: clearTrace, fit: fit, zoom: zoomAt, focus: focusNode,
      view: function () { return { x: view.x, y: view.y, w: view.w, h: view.h, z: view.z }; },
      node: function (id) { return nodes[id]; }, graph: graph, center: centerNode, destroy: function () {
        root.removeEventListener('pointermove', onPanMove); root.removeEventListener('pointerup', onPanEnd);
        clearTimeout(tipTimer); clearTimeout(movingT); host.innerHTML = ''; hideTip();
      } };
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
    return '<g class="hmi-node" data-box="1" data-node="' + esc(n.id) + '" data-sym="' + esc(n.boxSym || 'box') + '"' +
      (n.cls ? ' data-rz-equipment="' + esc(n.cls) + ':' + esc(n.eqId || n.id) + '"' : '') +
      ' tabindex="0" role="button" aria-label="' + esc(label) + '"' + (n.lod ? ' data-lod="' + n.lod + '"' : '') + '>' +
      '<title>' + esc(label) + '</title><g data-sym="' + esc(n.boxSym || 'box') + '"><rect class="b" x="' + r1(x) + '" y="' + r1(y) + '" width="' + w + '" height="' + h +
      '" fill="none" stroke="currentColor" stroke-width="1"/>' + marks + '</g>' +
      (n.text ? '<text data-role="' + (n.textRole || 'label') + '" x="' + r1(x + 4) + '" y="' + r1(n.textAt === 'top' ? y + 12 : y + h / 2 + 3.2) + '">' + esc(n.text) + '</text>' : '') +
      '</g>' + boxLines(n, x, y);
  }
  /* a room-sized box (a fire zone on DH-F-104) carries its name and live values inside, top-left under its text, 12 px
     apart like a symbol's tag / name / rating stack; outside the node group so they are text, not the hit target */
  function boxLines(n, x, y) {
    var out = '', ly = y + 12 + (n.text ? 12 : 0), vs = n.values || [];
    var flat = n.name && vs.length === 1 && ly + 12 + 4 > y + n.box[1];   // a shallow box: the value goes right-aligned on the name's line
    if (n.name) { out += '<text data-role="name" data-name-of="' + esc(n.id) + '" x="' + r1(x + 4) + '" y="' + r1(ly) + '">' + esc(n.name) + '</text>'; if (!flat) ly += 12; }
    vs.forEach(function (v) {
      out += '<text data-role="value" data-lod="' + (v.lod || 1) + '" data-val="' + esc(n.id) + ':' + esc(v.k) + '" x="' + r1(flat ? x + n.box[0] - 4 : x + 4) + '" y="' + r1(ly) + '"' + (flat ? ' text-anchor="end"' : '') + '>—</text>'; ly += 12;
    });
    return out;
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

  root.RZHmiSheet = { render: render, shadeMode: shadeMode, setShadeMode: setShadeMode, version: '1.2.0' };
})(typeof window !== 'undefined' ? window : null);
