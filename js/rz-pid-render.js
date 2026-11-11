/*!
 * rz-pid-render.js — the interactive P&ID drawing (resistancezero.com, R116/R117). Browser only.
 *
 * Needs rz-pid-build.js and rz-pid-graph.js first; adds RZPid.render(opts). Draws the plant from its graph and
 * layout, lights the active step, pulses the signals, and on a phone (<= 600 px) fits the lit path into the frame
 * with one transform instead of panning sideways. Tags are RZExplain triggers (data-explain="isa-…"), so what a
 * tag MEANS lives in the explanation DB; the line under the drawing shows only the item's own data.
 * Motion: transform / opacity / stroke-dashoffset only, on the --rz-dur-* / --rz-ease-* tokens; reduced motion
 * keeps the lit/dim change and moves the camera instantly. Vanilla ES5, no build.
 */
(function (root) {
  'use strict';
  var RZ = root.RZPid;
  if (typeof document === 'undefined' || !RZ || !RZ._ || RZ.render) return;
  var U = root.RZPidBuild._, U2 = RZ._, has = U.has, pad2 = U.pad2, slug = U.slug, conf = U.conf;
  var ACTUATED_COMPONENT_KINDS = U.ACTUATED_COMPONENT_KINDS, parseIsaTag = RZ.parseIsaTag;
  var ITEM_HINT = 'Point at, tap or focus a symbol for its data; a tag also explains its ISA-5.1 letters.';
  var MIN_LABEL_PX = 11;     /* no label on the phone drawing renders smaller than this */
  var CAM_MAX_SCALE = 1.6;   /* a short path is not blown up past this */

  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in (attrs || {})) if (has(attrs, k) && attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, s, cls, anchor, extra) {
    var t = el('text', { x: x, y: y, 'class': cls, 'text-anchor': anchor || 'middle' }, parent);
    for (var k in (extra || {})) if (has(extra, k)) t.setAttribute(k, extra[k]);
    t.textContent = s;
    return t;
  }
  function pts(list) { return list.map(function (p) { return (Math.round(p[0] * 10) / 10) + ',' + (Math.round(p[1] * 10) / 10); }).join(' '); }
  function pathD(list) { return list.map(function (p, i) { return (i ? 'L' : 'M') + (Math.round(p[0] * 10) / 10) + ' ' + (Math.round(p[1] * 10) / 10); }).join(' '); }
  function polyLen(list) { var L = 0; for (var i = 1; i < list.length; i++) L += Math.hypot(list[i][0] - list[i - 1][0], list[i][1] - list[i - 1][1]); return L; }
  function nearestOnPoly(list, p) {
    var best = null, bd = Infinity;
    for (var i = 1; i < list.length; i++) {
      var a = list[i - 1], b = list[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
      var t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
      var q = [a[0] + t * dx, a[1] + t * dy], d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  }
  function nearestOnRect(r, p) { return [Math.max(r.x0, Math.min(r.x1, p[0])), Math.max(r.y0, Math.min(r.y1, p[1]))]; }
  /* where the leg from c toward p leaves a shape */
  function exitPoint(shape, toward) {
    var c = [shape.cx, shape.cy], dx = toward[0] - c[0], dy = toward[1] - c[1], L = Math.hypot(dx, dy) || 1;
    if (shape.r) return [c[0] + dx / L * shape.r, c[1] + dy / L * shape.r];
    var hx = (shape.x1 - shape.x0) / 2, hy = (shape.y1 - shape.y0) / 2;
    var tx = dx ? hx / Math.abs(dx) : Infinity, ty = dy ? hy / Math.abs(dy) : Infinity, t = Math.min(tx, ty);
    return [c[0] + dx * t, c[1] + dy * t];
  }
  function cssVar(node, name, fallback) {
    try { var v = getComputedStyle(node).getPropertyValue(name).trim(); return v || fallback; } catch (e) { return fallback; }
  }
  function ms(v, fallback) { var m = /^([\d.]+)\s*(ms|s)?$/.exec(String(v || '').trim()); if (!m) return fallback; return parseFloat(m[1]) * (m[2] === 's' ? 1000 : 1); }

  var CSS = [
    '.rzpid-svg{display:block;font-family:"JetBrains Mono",ui-monospace,monospace}',
    '.rzpid-svg .pipe{fill:none;stroke-width:2.2;stroke-linejoin:round}',
    '.rzpid-svg .pipe.cold{stroke:var(--pid-cold,#6E8FAE)}.rzpid-svg .pipe.warm{stroke:var(--pid-warm,#A87A6A)}.rzpid-svg .pipe.plain{stroke:var(--pid-ink2,#8b929b)}',
    '.rzpid-svg .pipe.low{stroke-dasharray:7 5}',
    '.rzpid-svg .arrow{stroke:none}.rzpid-svg .arrow.cold{fill:var(--pid-cold)}.rzpid-svg .arrow.warm{fill:var(--pid-warm)}.rzpid-svg .arrow.plain{fill:var(--pid-ink2)}',
    '.rzpid-svg .flowdash{fill:none;stroke:var(--pid-bg,#121316);stroke-width:1.4;stroke-dasharray:5 13;stroke-linecap:butt;opacity:0}',
    '.rzpid-svg .sig{fill:none;stroke:var(--pid-ink2);stroke-width:1}',
    '.rzpid-svg .sig.electrical{stroke-dasharray:5 3}.rzpid-svg .sig.software{stroke-dasharray:2 3}.rzpid-svg .sig.unknown{stroke-dasharray:1 3}',
    '.rzpid-svg .sigmark{fill:none;stroke:var(--pid-ink2);stroke-width:1}.rzpid-svg .sighead{fill:var(--pid-ink2)}',
    '.rzpid-svg .conn{stroke:var(--pid-ink2);stroke-width:1;fill:none}',
    '.rzpid-svg .sym{fill:var(--pid-bg,#121316);stroke:var(--pid-ink,#e8edf5);stroke-width:1.3}',
    '.rzpid-svg .sym.low{stroke-dasharray:3 2.5}',
    '.rzpid-svg .symfill{fill:var(--pid-ink,#e8edf5);stroke:none}.rzpid-svg .symline{fill:none;stroke:var(--pid-ink);stroke-width:1}',
    '.rzpid-svg .tag{font-size:11px;fill:var(--pid-ink);font-weight:500}.rzpid-svg .bub{font-size:9.6px;fill:var(--pid-ink);font-weight:500}',
    '.rzpid-svg .sub{font-size:10px;fill:var(--pid-muted,#9aa3ad)}.rzpid-svg .flag{fill:var(--pid-bg);stroke:var(--pid-ink2);stroke-width:1}',
    '.rzpid-svg .rope{stroke:var(--pid-ink2);stroke-width:1;stroke-dasharray:2 3;fill:none}',
    '.rzpid-svg .hit{fill:transparent;stroke:none;cursor:pointer}.rzpid-svg g.node:focus{outline:none}',
    '.rzpid-svg g.node:focus-visible .sym,.rzpid-svg g.node:focus-visible .flag{stroke:var(--pid-accent);stroke-width:2}',
    '.rzpid-svg .pulse{fill:var(--pid-accent);stroke:var(--pid-bg);stroke-width:1.5;opacity:0;pointer-events:none}',
    /* selection: lit vs dim — opacity only, on the motion tokens */
    '.rzpid-svg [data-id],.rzpid-svg [data-edge]{transition:opacity var(--rz-dur-menu,200ms) var(--rz-ease-out,cubic-bezier(.23,1,.32,1))}',
    '.rzpid-svg.has-sel [data-id]:not(.is-lit),.rzpid-svg.has-sel [data-edge]:not(.is-lit){opacity:.34}',
    '.rzpid-svg .is-lit .pipe,.rzpid-svg .is-lit.sig-g .sig,.rzpid-svg .is-lit .conn{stroke:var(--pid-accent)}',
    '.rzpid-svg .is-lit .arrow,.rzpid-svg .is-lit .sighead{fill:var(--pid-accent)}',
    '.rzpid-svg .is-lit .sym,.rzpid-svg .is-lit .flag{stroke:var(--pid-accent)}',
    '.rzpid-svg .is-lit .tag,.rzpid-svg .is-lit .bub{fill:var(--pid-accent-text,var(--pid-accent))}',
    '.rzpid-svg .is-flowing .flowdash{opacity:1;animation:rzpid-flow var(--rz-dur-explain,600ms) linear infinite}',
    /* constant-velocity fluid: linear is the physics, not a styling choice. 18 = one dash period. */
    '@keyframes rzpid-flow{from{stroke-dashoffset:18}to{stroke-dashoffset:0}}',
    '.rzpid-paused .is-flowing .flowdash{animation-play-state:paused}',
    /* phone camera: the drawing moves by transform only; a label that would render under 11 px fades out */
    '.rzpid-cam{transition:transform var(--rz-dur-panel,280ms) var(--rz-ease-in-out,cubic-bezier(.77,0,.175,1))}',
    '.rzpid-svg text{transition:opacity var(--rz-dur-menu,200ms) var(--rz-ease-out,cubic-bezier(.23,1,.32,1))}.rzpid-svg text.is-small{opacity:0}',
    '@media (max-width:600px){.rzpid-svg .bub,.rzpid-svg .sub{font-size:11px}.rzpid-svg .tag{font-size:12px}.rzpid-item{min-height:0;padding:6px 12px;font-size:12.5px}}',
    '@media (prefers-reduced-motion:reduce){.rzpid-svg .is-flowing .flowdash{animation:none;opacity:0}.rzpid-svg [data-id],.rzpid-svg [data-edge]{transition-duration:1ms}.rzpid-cam,.rzpid-svg text{transition:none}}',
    '.rzpid-item{margin:0;padding:8px 14px;border-top:1px solid var(--pid-line,rgba(255,255,255,.14));font:13px/1.45 "IBM Plex Sans",system-ui,sans-serif;color:var(--pid-muted,#9aa3ad);min-height:2.9em}',
    '.rzpid-item b{font:500 12.5px "JetBrains Mono",monospace;color:var(--pid-ink)}'
  ].join('\n');
  function injectCss() {
    if (document.getElementById('rzpid-css')) return;
    var s = document.createElement('style'); s.id = 'rzpid-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  function render(opts) {
    injectCss();
    var doc = opts.doc, page = doc.pages[0], L = doc.layout || {}, W = L.viewBox[0], H = L.viewBox[1];
    var g = RZ.buildGraph(doc.pages, doc.plant.id, doc.plant.name);
    var ex = RZ.explain(g);
    var P = page.page;
    var items = {};
    ['equipment', 'components', 'instruments', 'boundaries'].forEach(function (grp) { (page[grp] || []).forEach(function (it) { items[it.id] = { grp: grp, it: it }; }); });
    function box(localId) {
      var b = items[localId].it.bbox; if (!b) return null;
      var r = { x0: b[0] * W, y0: b[1] * H, x1: b[2] * W, y1: b[3] * H };
      r.cx = (r.x0 + r.x1) / 2; r.cy = (r.y0 + r.y1) / 2; r.w = r.x1 - r.x0; r.h = r.y1 - r.y0;
      return r;
    }
    function anchor(localId) { var a = (L.anchors || {})[localId]; if (a) return a; var b = box(localId); return [b.cx, b.cy]; }
    function gid(localId) { return g.resolve(P, localId); }
    function low(c) { return c !== undefined && c < RZ.LOW_CONFIDENCE; }

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, 'class': 'rzpid-svg', role: 'img', 'aria-label': doc.plant.name + ' — piping and instrumentation diagram' });
    var title = el('title', {}, svg); title.textContent = doc.plant.name + ' P&ID';
    var gCam = el('g', { 'class': 'rzpid-cam' }, svg);
    var gPipes = el('g', {}, gCam), gSig = el('g', {}, gCam), gConn = el('g', {}, gCam), gSym = el('g', {}, gCam), gPulse = el('g', {}, gCam);
    var shapes = {}; // graph id -> shape for clipping
    var minX = 0, maxX = W;
    var segPoly = {}, sigPoly = {};

    function mediaClass(service) {
      var s = String(service || '').toLowerCase();
      if (/return/.test(s)) return 'warm';
      if (/supply|bypass/.test(s)) return 'cold';
      return 'plain';
    }
    function drawArrow(parent, poly, cls) {
      var best = -1, bl = 0;
      for (var i = 1; i < poly.length; i++) { var l = Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]); if (l > bl) { bl = l; best = i; } }
      if (best < 0 || bl < 36) return;
      var a = poly[best - 1], b = poly[best], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      el('path', { d: 'M4 0 L-4 -3.6 L-4 3.6 Z', 'class': 'arrow ' + cls, transform: 'translate(' + mx.toFixed(1) + ' ' + my.toFixed(1) + ') rotate(' + ang.toFixed(1) + ')' }, parent);
    }

    /* pipes: one <g data-id> per PipeSegment, split at the line's path items */
    (page.lines || []).forEach(function (line) {
      var route = (L.routes || {})[line.id]; if (!route) return;
      var cut = [0];
      (line.path || []).forEach(function (ref) {
        var a = anchor(ref), from = cut[cut.length - 1], found = -1;
        for (var i = from; i < route.length; i++) if (Math.abs(route[i][0] - a[0]) < 0.6 && Math.abs(route[i][1] - a[1]) < 0.6) { found = i; break; }
        if (found < 0) throw new Error('rz-pid: route ' + line.id + ' does not pass ' + ref);
        cut.push(found);
      });
      cut.push(route.length - 1);
      var cls = mediaClass(line.service), lc = conf(line, 0.85);
      for (var k = 1; k < cut.length; k++) {
        var poly = route.slice(cut[k - 1], cut[k] + 1), sid = 'P' + pad2(P) + '.' + line.id + '.' + k;
        var sg = el('g', { 'data-id': sid, 'class': 'seg' }, gPipes);
        el('path', { d: pathD(poly), 'class': 'pipe ' + cls + (low(lc) ? ' low' : '') }, sg);
        el('path', { d: pathD(poly), 'class': 'flowdash' }, sg);
        drawArrow(sg, poly, cls);
        segPoly[sid] = poly;
      }
    });

    /* symbols */
    function nodeGroup(localId, extraCls) {
      /* a tag explains its ISA-5.1 letters through RZExplain (content in the DB, never here) */
      var id = gid(localId), key = RZ.explainKey(g.byId[id]);
      return el('g', { 'data-id': id, 'class': 'node ' + (extraCls || ''), tabindex: key ? '0' : '-1', 'data-explain': key,
        'aria-label': key ? g.byId[id].label : null }, gSym);
    }
    function tagAt(grp, localId, s, x, y, anchorDflt) {
      var o = (L.labels || {})[localId];
      if (o) return txt(grp, x + o[0], y + o[1], s, 'tag', o[2] || 'middle');
      return txt(grp, x, y, s, 'tag', anchorDflt || 'middle');
    }
    function rot(localId) { return ((L.rotate || {})[localId]) || 0; }

    (page.boundaries || []).forEach(function (b) {
      var r = box(b.id), id = gid(b.id), grp = nodeGroup(b.id, 'boundary'), lc = conf(b, 0.9);
      shapes[id] = r;
      if (b.direction === 'area') {
        el('line', { x1: r.x0, y1: r.cy, x2: r.x1, y2: r.cy, 'class': 'rope' }, grp);
        txt(grp, r.x1, r.cy - 6, b.name, 'sub', 'end');
        return;
      }
      var tip = (L.flagTip || {})[b.id] || 'right', d = 8;
      var need = String(b.name).length * 10 * 0.6 + 2 * d + 6;
      if (need > r.w) { if (r.cx < W / 2) r.x0 = r.x1 - need; else r.x1 = r.x0 + need; r.w = need; r.cx = (r.x0 + r.x1) / 2; }
      minX = Math.min(minX, r.x0 - 4); maxX = Math.max(maxX, r.x1 + 4);
      var poly = tip === 'right' ? [[r.x0, r.y0], [r.x1 - d, r.y0], [r.x1, r.cy], [r.x1 - d, r.y1], [r.x0, r.y1]]
                                 : [[r.x0 + d, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0 + d, r.y1], [r.x0, r.cy]];
      el('polygon', { points: pts(poly), 'class': 'flag' + (low(lc) ? ' sym low' : '') }, grp);
      txt(grp, r.cx + (tip === 'right' ? -d / 2 : d / 2), r.cy + 3.2, b.name, 'sub', 'middle');
      el('rect', { x: r.x0, y: r.y0, width: r.w, height: r.h, 'class': 'hit' }, grp);
    });

    (page.equipment || []).forEach(function (eq) {
      var r = box(eq.id), id = gid(eq.id), grp = nodeGroup(eq.id, 'equipment'), lc = conf(eq, 0.9), k = slug(eq.kind), cls = 'sym' + (low(lc) ? ' low' : '');
      shapes[id] = r;
      if (k === 'heat_exchanger' || k === 'cooler' || k === 'heater') {
        el('rect', { x: r.x0, y: r.y0, width: r.w, height: r.h, rx: 2, 'class': cls }, grp);
        for (var y = r.y0 + 18; y < r.y1 - 18; y += 22) if (Math.abs(y + 5 - r.cy) > 70) el('path', { d: 'M' + (r.x0 + 6) + ' ' + y + ' L' + (r.x1 - 6) + ' ' + (y + 11), 'class': 'symline' }, grp);
        txt(grp, r.cx, r.cy, eq.tag + ' · ' + (eq.name || 'heat exchanger').toUpperCase(), 'tag', 'middle', { transform: 'rotate(-90 ' + r.cx + ' ' + r.cy + ')', dy: '3' });
      } else if (/pump/.test(k)) {
        var rr = Math.min(r.w, r.h) / 2;
        el('circle', { cx: r.cx, cy: r.cy, r: rr, 'class': cls }, grp);
        var a = (rot(eq.id) || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
        var tri = [[rr * 0.62, 0], [-rr * 0.42, -rr * 0.62], [-rr * 0.42, rr * 0.62]].map(function (p) { return [r.cx + p[0] * ca - p[1] * sa, r.cy + p[0] * sa + p[1] * ca]; });
        el('polygon', { points: pts(tri), 'class': 'symline' }, grp);
        tagAt(grp, eq.id, eq.tag, r.cx, r.y1 + 12);
        shapes[id] = { cx: r.cx, cy: r.cy, r: rr };
      } else if (k === 'vessel' || k === 'tank' || k === 'pressure_vessel') {
        el('rect', { x: r.x0, y: r.y0, width: r.w, height: r.h, rx: r.w / 2, ry: Math.min(r.w / 2, 10), 'class': cls }, grp);
        el('line', { x1: r.x0 + 3, y1: r.cy + 4, x2: r.x1 - 3, y2: r.cy + 4, 'class': 'symline', 'stroke-dasharray': '3 2' }, grp);
        tagAt(grp, eq.id, eq.tag, r.x1 + 6, r.cy + 3, 'start');
      } else {
        el('rect', { x: r.x0, y: r.y0, width: r.w, height: r.h, 'class': cls }, grp);
        el('path', { d: 'M' + r.x0 + ' ' + r.y1 + ' L' + r.x1 + ' ' + r.y0, 'class': 'symline', 'stroke-dasharray': '3 2' }, grp);
        tagAt(grp, eq.id, eq.tag, r.cx, r.y0 - 6);
      }
      el('rect', { x: r.x0, y: r.y0, width: r.w, height: r.h, 'class': 'hit' }, grp);
    });

    (page.components || []).forEach(function (c) {
      var id = gid(c.id), grp = nodeGroup(c.id, 'component'), lc = conf(c, 0.9), k = slug(c.kind), cls = 'sym' + (low(lc) ? ' low' : '');
      var p = anchor(c.id), x = p[0], y = p[1], a = rot(c.id);
      var body = el('g', { transform: 'translate(' + x + ' ' + y + ') rotate(' + a + ')' }, grp);
      var bow = 'M-8 -5.5 L0 0 L-8 5.5 Z M8 -5.5 L0 0 L8 5.5 Z';
      if (k === 'relief_valve') {
        el('path', { d: 'M-5.5 8 L0 0 L5.5 8 Z M8 -5.5 L0 0 L8 5.5 Z', 'class': cls }, body);
        el('path', { d: 'M0 0 V-4 l-3 -2 l6 -3 l-6 -3 l6 -3 l-3 -2', 'class': 'symline' }, body);
      } else if (k === 'check_valve') {
        el('path', { d: 'M-8 -5.5 L0 0 L-8 5.5 Z', 'class': cls }, body);
        el('path', { d: 'M8 -5.5 L0 0 L8 5.5 Z', 'class': 'symfill' }, body);
      } else {
        el('path', { d: bow, 'class': cls }, body);
        if (k === 'three_way_valve') el('path', { d: 'M-5.5 8 L0 0 L5.5 8 Z', 'class': cls }, body);
        if (has(ACTUATED_COMPONENT_KINDS, k) || (c.actuator && c.actuator !== 'manual')) {
          el('line', { x1: 0, y1: 0, x2: 0, y2: -12, 'class': 'symline' }, body);
          el('rect', { x: -6, y: -20, width: 12, height: 8, 'class': cls }, body);
        }
      }
      var top = (has(ACTUATED_COMPONENT_KINDS, k) ? 28 : 12);
      if (c.tag) tagAt(grp, c.id, c.tag, x, y - top + 2);
      var sh = { cx: x, cy: y, x0: x - 9, x1: x + 9, y0: y - (has(ACTUATED_COMPONENT_KINDS, k) ? 21 : 7), y1: y + 9 };
      shapes[id] = sh;
      el('rect', { x: sh.x0 - 2, y: sh.y0 - 2, width: sh.x1 - sh.x0 + 4, height: sh.y1 - sh.y0 + 4, 'class': 'hit' }, grp);
    });

    var R = 15;
    (page.instruments || []).forEach(function (ins) {
      var id = gid(ins.id), grp = nodeGroup(ins.id, 'instrument'), lc = conf(ins, 0.9), cls = 'sym' + (low(lc) ? ' low' : '');
      var r = box(ins.id), x = r.cx, y = r.cy, loc = ins.location || 'unknown';
      if (g.byId[id].attributes.inline) {
        var p = anchor(ins.id);
        el('line', { x1: x, y1: y + R, x2: p[0], y2: p[1] - 4, 'class': 'conn' }, grp);
        el('rect', { x: p[0] - 5, y: p[1] - 4, width: 10, height: 8, 'class': cls }, grp);
      }
      if (loc === 'dcs' || loc === 'plc' || loc === 'scada') {
        el('rect', { x: x - R - 1, y: y - R - 1, width: 2 * R + 2, height: 2 * R + 2, 'class': cls }, grp);
        if (loc === 'plc') el('path', { d: 'M' + x + ' ' + (y - R) + ' L' + (x + R) + ' ' + y + ' L' + x + ' ' + (y + R) + ' L' + (x - R) + ' ' + y + ' Z', 'class': cls }, grp);
        else el('circle', { cx: x, cy: y, r: R, 'class': cls }, grp);
        shapes[id] = { cx: x, cy: y, x0: x - R - 1, x1: x + R + 1, y0: y - R - 1, y1: y + R + 1 };
      } else {
        el('circle', { cx: x, cy: y, r: R, 'class': cls }, grp);
        shapes[id] = { cx: x, cy: y, r: R };
      }
      if (loc === 'main_panel') el('line', { x1: x - R, y1: y, x2: x + R, y2: y, 'class': 'symline' }, grp);
      if (loc === 'behind_panel') el('line', { x1: x - R, y1: y, x2: x + R, y2: y, 'class': 'symline', 'stroke-dasharray': '2 2' }, grp);
      if (loc === 'local_panel') { el('line', { x1: x - R, y1: y - 1.5, x2: x + R, y2: y - 1.5, 'class': 'symline' }, grp); el('line', { x1: x - R, y1: y + 1.5, x2: x + R, y2: y + 1.5, 'class': 'symline' }, grp); }
      var isa = parseIsaTag(ins.tag);
      txt(grp, x, y - 1.5, isa ? isa.letters : (ins['function'] || '?'), 'bub');
      txt(grp, x, y + 8, isa ? isa.number + isa.suffix : '', 'bub');
      el('rect', { x: x - R - 2, y: y - R - 2, width: 2 * R + 4, height: 2 * R + 4, 'class': 'hit' }, grp);
    });

    /* process connections (MEASURES) — thin solid, bubble to the point it senses */
    g.edges.forEach(function (e) {
      if (e.type !== 'MEASURES' || e.attributes.inline || e.derived) return;
      var s = shapes[e.source], t = e.target, target = null;
      if (!s) return;
      if (segPoly[t]) target = nearestOnPoly(segPoly[t], [s.cx, s.cy]);
      else if (shapes[t] && shapes[t].r) target = exitPoint(shapes[t], [s.cx, s.cy]);
      else if (shapes[t]) target = g.byId[t].type === 'Boundary' && g.byId[t].attributes.direction === 'area' ? [Math.max(shapes[t].x0, Math.min(shapes[t].x1, s.cx)), shapes[t].cy] : nearestOnRect(shapes[t], [s.cx, s.cy]);
      if (!target) return;
      var start = exitPoint(s, target);
      var cg = el('g', { 'data-edge': e.id, 'class': 'conn-g' }, gConn);
      el('path', { d: pathD([start, target]), 'class': 'conn' + (low(e.confidence) ? ' low' : ''), 'stroke-dasharray': low(e.confidence) ? '3 2' : null }, cg);
    });

    /* signal lines — dashed by type, routed through layout waypoints, clipped at both shapes */
    var sigRoutes = L.signals || {};
    g.edges.forEach(function (e) {
      if (e.type !== 'SIGNAL_TO') return;
      var s = shapes[e.source], t = shapes[e.target]; if (!s || !t) return;
      var key = (g.byId[e.source].tag || e.source) + '>' + (g.byId[e.target].tag || e.target);
      var mid = sigRoutes[key] || [[t.cx, s.cy]];
      var poly = [exitPoint(s, mid[0])].concat(mid, [exitPoint(t, mid[mid.length - 1])]);
      sigPoly[e.id] = poly;
      var type = e.attributes.signal_type || 'unknown';
      var sg = el('g', { 'data-edge': e.id, 'class': 'sig-g' }, gSig);
      el('path', { d: pathD(poly), 'class': 'sig ' + type + (low(e.confidence) ? ' low' : '') }, sg);
      var len = polyLen(poly);
      if (type === 'pneumatic' || type === 'software') {
        for (var d = 14; d < len - 10; d += 22) {
          var q = along(poly, d);
          if (type === 'pneumatic') el('path', { d: 'M' + (q.p[0] - 3) + ' ' + (q.p[1] + 4) + ' l4 -8 M' + (q.p[0] + 1) + ' ' + (q.p[1] + 4) + ' l4 -8', 'class': 'sigmark', transform: 'rotate(' + q.ang + ' ' + q.p[0] + ' ' + q.p[1] + ')' }, sg);
          else el('circle', { cx: q.p[0], cy: q.p[1], r: 1.6, 'class': 'sigmark' }, sg);
        }
      }
      var end = poly[poly.length - 1], prev = poly[poly.length - 2], ang = Math.atan2(end[1] - prev[1], end[0] - prev[0]) * 180 / Math.PI;
      el('path', { d: 'M0 0 L-6 -2.6 L-6 2.6 Z', 'class': 'sighead', transform: 'translate(' + end[0].toFixed(1) + ' ' + end[1].toFixed(1) + ') rotate(' + ang.toFixed(1) + ')' }, sg);
    });
    function along(poly, dist) {
      for (var i = 1; i < poly.length; i++) {
        var a = poly[i - 1], b = poly[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (dist <= l) { var t = l ? dist / l : 0; return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], ang: Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI }; }
        dist -= l;
      }
      var z = poly[poly.length - 1]; return { p: z, ang: 0 };
    }

    /* a flag sized to its own text may reach past the authored frame: grow the frame, never clip */
    var full = { x: minX, y: 0, w: maxX - minX, h: H };
    svg.setAttribute('viewBox', full.x.toFixed(1) + ' 0 ' + full.w.toFixed(1) + ' ' + H);

    /* ------------------------------------------------ DOM: figure + steps */
    var host = opts.host;
    host.classList.add('rzpid');
    var fig = document.createElement('figure'); fig.className = 'rzpid-fig';
    var frame = document.createElement('div'); frame.className = 'rzpid-frame'; frame.tabIndex = 0;
    frame.setAttribute('role', 'region'); frame.setAttribute('aria-label', 'P&ID drawing');
    frame.appendChild(svg); fig.appendChild(frame);
    /* the item's own data (what it is, where, its value and source); what its tag MEANS is RZExplain's */
    var item = document.createElement('p'); item.className = 'rzpid-item'; item.setAttribute('aria-live', 'polite');
    item.textContent = ITEM_HINT; fig.appendChild(item);
    if (opts.caption) { var fc = document.createElement('figcaption'); fc.className = 'rzpid-cap'; fc.textContent = opts.caption; fig.appendChild(fc); }
    (opts.figureHost || host).appendChild(fig);

    var list = document.createElement('div'); list.className = 'rzpid-steps';
    var stepBtns = [];
    ex.sections.forEach(function (sec) {
      var mine = ex.steps.filter(function (s) { return s.section === sec.id; }); if (!mine.length) return;
      var h = document.createElement('h3'); h.className = 'rzpid-sec'; h.textContent = sec.title; list.appendChild(h);
      var ol = document.createElement('ol'); ol.className = 'rzpid-ol';
      mine.forEach(function (s) {
        var li = document.createElement('li');
        var b = document.createElement('button'); b.type = 'button'; b.className = 'rzpid-step'; b.setAttribute('data-step', s.id);
        b.setAttribute('aria-pressed', 'false'); b.tabIndex = -1;
        var n = document.createElement('span'); n.className = 'rzpid-n'; n.textContent = pad2(ex.steps.indexOf(s) + 1);
        var t = document.createElement('span'); t.className = 'rzpid-t'; t.textContent = s.title;
        var body = document.createElement('span'); body.className = 'rzpid-b'; body.textContent = s.text;
        b.appendChild(n); b.appendChild(t); b.appendChild(body);
        li.appendChild(b); ol.appendChild(li); stepBtns.push(b);
      });
      list.appendChild(ol);
    });
    (opts.stepsHost || host).appendChild(list);

    /* ------------------------------------------------ behaviour */
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var current = -1, live = [], paused = false;
    function stopPulses() { live.forEach(function (a) { try { a.cancel(); } catch (e) { /* already gone */ } }); live = []; while (gPulse.firstChild) gPulse.removeChild(gPulse.firstChild); }
    function pulse(stages) {
      if (reduce || !stages || !stages.length || !svg.animate) return;
      var hop = ms(cssVar(svg, '--rz-dur-explain', '600ms'), 600);
      var ease = cssVar(svg, '--rz-ease-in-out', 'cubic-bezier(.77,0,.175,1)');
      stages.forEach(function (stage, si) {
        stage.forEach(function (eid) {
          var poly = sigPoly[eid]; if (!poly) return;
          var len = polyLen(poly) || 1, acc = 0, frames = [];
          for (var i = 0; i < poly.length; i++) {
            if (i) acc += Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]);
            frames.push({ transform: 'translate(' + poly[i][0].toFixed(1) + 'px,' + poly[i][1].toFixed(1) + 'px)', offset: acc / len });
          }
          frames[0].opacity = 0.0001; frames[frames.length - 1].opacity = 0;
          for (var f = 1; f < frames.length - 1; f++) frames[f].opacity = 1;
          if (frames.length === 2) frames.splice(1, 0, { transform: 'translate(' + ((poly[0][0] + poly[1][0]) / 2).toFixed(1) + 'px,' + ((poly[0][1] + poly[1][1]) / 2).toFixed(1) + 'px)', opacity: 1, offset: 0.5 });
          var dot = el('circle', { cx: 0, cy: 0, r: 3.4, 'class': 'pulse' }, gPulse);
          var anim = dot.animate(frames, { duration: hop, delay: si * hop, easing: ease, fill: 'none' });
          if (paused) anim.pause();
          anim.onfinish = function () { if (dot.parentNode) dot.parentNode.removeChild(dot); };
          live.push(anim);
        });
      });
    }
    /* phone (<= 600 px): no sideways pan. The svg is the frame's own pixel size and the drawing inside it is moved by
       one transform to fit the lit path; a label that would render under 11 px is faded out, never shown illegible. */
    var phoneMq = window.matchMedia ? window.matchMedia('(max-width: 600px)') : null;
    function isPhone() { return !!(phoneMq && phoneMq.matches); }
    function litBox() {
      var lit = svg.querySelectorAll('.is-lit'), x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (var k = 0; k < lit.length; k++) {
        var bb = lit[k].getBBox(); if (!bb.width && !bb.height) continue;
        x0 = Math.min(x0, bb.x); y0 = Math.min(y0, bb.y); x1 = Math.max(x1, bb.x + bb.width); y1 = Math.max(y1, bb.y + bb.height);
      }
      return x0 === Infinity ? full : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    function camera() {
      var texts = svg.querySelectorAll('text'), t;
      if (!isPhone()) {
        svg.setAttribute('viewBox', full.x.toFixed(1) + ' 0 ' + full.w.toFixed(1) + ' ' + H);
        svg.style.height = ''; gCam.style.transform = '';
        for (t = 0; t < texts.length; t++) texts[t].classList.remove('is-small');
        return;
      }
      var cs = getComputedStyle(frame), vw = frame.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      var vh = Math.round(Math.min(vw * 1.15, window.innerHeight * 0.46)), b = current >= 0 ? litBox() : full, pad = 10;
      svg.setAttribute('viewBox', '0 0 ' + vw.toFixed(1) + ' ' + vh); svg.style.height = vh + 'px';
      var k = Math.min((vw - 2 * pad) / Math.max(b.w, 1), (vh - 2 * pad) / Math.max(b.h, 1), CAM_MAX_SCALE);
      var tx = vw / 2 - k * (b.x + b.w / 2), ty = vh / 2 - k * (b.y + b.h / 2);
      gCam.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + k.toFixed(4) + ')';
      for (t = 0; t < texts.length; t++) texts[t].classList.toggle('is-small', parseFloat(getComputedStyle(texts[t]).fontSize) * k < MIN_LABEL_PX);
    }
    /* tablet: bring the lit part of the drawing into the frame (instant — scrolling is not decoration) */
    function revealLit() {
      if (frame.scrollWidth <= frame.clientWidth + 1) return;
      var lit = svg.querySelectorAll('.is-lit'), fr = frame.getBoundingClientRect(), lo = Infinity, hi = -Infinity;
      for (var k = 0; k < lit.length; k++) { var r = lit[k].getBoundingClientRect(); if (!r.width && !r.height) continue; lo = Math.min(lo, r.left); hi = Math.max(hi, r.right); }
      if (lo === Infinity) return;
      var left = lo - fr.left + frame.scrollLeft, right = hi - fr.left + frame.scrollLeft, view = frame.clientWidth;
      if (left >= frame.scrollLeft && right <= frame.scrollLeft + view) return;
      frame.scrollLeft = right - left <= view ? Math.max(0, (left + right) / 2 - view / 2) : Math.max(0, left - 12);
    }
    function select(i, focus) {
      if (i < 0 || i >= ex.steps.length) return;
      current = i;
      var s = ex.steps[i], set = {};
      s.ids.forEach(function (x) { set[x] = 1; });
      svg.classList.add('has-sel');
      var els = svg.querySelectorAll('[data-id],[data-edge]');
      for (var k = 0; k < els.length; k++) {
        var key = els[k].getAttribute('data-id') || els[k].getAttribute('data-edge');
        var lit = !!set[key];
        els[k].classList.toggle('is-lit', lit);
        els[k].classList.toggle('is-flowing', lit && !!s.flow && !reduce && els[k].classList.contains('seg'));
      }
      stepBtns.forEach(function (b, j) { b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); b.tabIndex = j === i ? 0 : -1; });
      if (focus) stepBtns[i].focus();
      if (isPhone()) camera(); else revealLit();
      stopPulses();
      pulse(s.pulse);
      host.setAttribute('data-step', s.id);
    }
    stepBtns.forEach(function (b, j) {
      b.addEventListener('click', function () { select(j, false); });
      b.addEventListener('keydown', function (ev) {
        var k = ev.key, to = -1;
        if (k === 'ArrowDown' || k === 'ArrowRight') to = Math.min(stepBtns.length - 1, j + 1);
        else if (k === 'ArrowUp' || k === 'ArrowLeft') to = Math.max(0, j - 1);
        else if (k === 'Home') to = 0; else if (k === 'End') to = stepBtns.length - 1;
        if (to < 0) return;
        ev.preventDefault(); stepBtns.forEach(function (x) { x.tabIndex = -1; }); stepBtns[to].tabIndex = 0; stepBtns[to].focus();
      });
    });

    /* symbol data line + step selection; the ISA meaning comes from RZExplain on the same element */
    function itemText(id) {
      var n = g.byId[id]; if (!n) return '';
      var ix = U2.index(g), out = [], v = U2.valueText(n);
      if (n.type === 'Instrument') {
        out.push('mounted ' + (RZ.LOCATION_WORD[n.attributes.location] || n.attributes.location));
        var w = U2.measuredWhere(g, ix, id); if (w) out.push('senses ' + w);
      } else if (n.kind) out.push(U.pretty(n.kind));
      if (v) out.push('value ' + v);
      var lp = ix.out(id, 'MEMBER_OF')[0];
      if (lp) out.push('loop ' + g.byId[lp.target].label + ' as ' + String(lp.attributes.role).replace(/_/g, ' '));
      else if (n.attributes.standalone) out.push('no loop: ' + n.attributes.standalone);
      if (n.confidence < RZ.LOW_CONFIDENCE) out.push('low confidence: ' + (n.attributes.basis || 'not drawn on the source page'));
      if (n.attributes.src && doc.sources && doc.sources[n.attributes.src]) out.push('source ' + doc.sources[n.attributes.src].ref);
      return out.join(' · ');
    }
    function showItem(gEl) {
      var id = gEl.getAttribute('data-id'), n = g.byId[id]; if (!n) return;
      var b = document.createElement('b'); b.textContent = n.label + (n.name && n.name !== n.label ? ' — ' + n.name : '');
      item.textContent = ''; item.appendChild(b); item.appendChild(document.createTextNode(' · ' + itemText(id)));
    }
    function pickStep(gEl) {
      var sid = ex.nodeStep[gEl.getAttribute('data-id')];
      if (!sid) return;
      var j = ex.steps.map(function (s) { return s.id; }).indexOf(sid);
      select(j, false); if (opts.onSymbol) opts.onSymbol(stepBtns[j]);
    }
    var nodes = svg.querySelectorAll('g.node');
    for (var q = 0; q < nodes.length; q++) (function (gEl) {
      gEl.addEventListener('pointerenter', function (ev) { if (ev.pointerType === 'mouse') showItem(gEl); });
      gEl.addEventListener('focus', function () { showItem(gEl); });
      gEl.addEventListener('click', function () { pickStep(gEl); showItem(gEl); });
      /* RZExplain takes the tap on a tag (it prevents the click), so the tap also selects the step here */
      if (gEl.hasAttribute('data-explain')) gEl.addEventListener('touchend', function () { pickStep(gEl); showItem(gEl); });
      gEl.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pickStep(gEl); } });
    })(nodes[q]);
    if (root.RZExplain) root.RZExplain.attachExplicit(svg);
    if (phoneMq) {
      var raf = 0, onSize = function () { if (raf) return; raf = (window.requestAnimationFrame || setTimeout)(function () { raf = 0; camera(); }); };
      window.addEventListener('resize', onSize);
      if (phoneMq.addListener) phoneMq.addListener(onSize);
    }
    camera();

    /* pause everything off-screen */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          paused = !en.isIntersecting;
          svg.classList.toggle('rzpid-paused', paused);
          live.forEach(function (a) { try { if (paused) a.pause(); else a.play(); } catch (e) { /* finished */ } });
        });
      }, { threshold: 0.05 }).observe(svg);
    }

    var api = { graph: g, explanation: ex, select: select, svg: svg, steps: stepBtns };
    host.__rzpid = api;
    if (opts.initial !== undefined) select(opts.initial, false);
    return api;
  }
  RZ.render = render;
})(typeof window !== 'undefined' ? window : globalThis);
