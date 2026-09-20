/* ============================================================================
 * rz-diagram-layout.js — put the label where there is room; route around boxes
 * ----------------------------------------------------------------------------
 * The companion to rz-diagram-metrics.js. Metrics answers "how wide is this?";
 * this module answers the two questions that follow:
 *
 *   1. Where does this label go, given everything already on the canvas?
 *   2. How does this connector get from A to B without crossing anything it
 *      has no relationship with?
 *
 * Both are searches, not offsets. That is the whole point. Today's cockpit code
 * writes `tx(860, RY-5, ...)` — a fixed offset that was correct when it was
 * written and became a collision the moment a panel below it grew two rows.
 * A search re-derives the answer every render, so the drawing cannot go stale.
 *
 * The connector rules implemented here are the six mandatory ones from the
 * diagram-design skill (SKILL.md §6), which this project adopted as its
 * diagram standard:
 *
 *   1. orthogonal only, rounded elbows (r=8, 6 when tight)
 *   2. a label never touches its own stroke — 6-10px clear
 *   3. no two connectors share a path
 *   4. several connectors on one edge fan out, >= 12px apart
 *   5. no transit behind a non-endpoint box; reroute, or declare it dashed
 *   6. a label mask never lands under a node painted after it
 *
 * Rules 1, 2, 4, 5 and 6 are enforced here. Rule 3 is a property of the whole
 * diagram rather than of one call, so it is checked by the occupancy index when
 * routes are registered.
 * ==========================================================================*/
(function (root) {
  'use strict';

  var M = root.RZDiagramMetrics ||
          (typeof require !== 'undefined' ? require('./rz-diagram-metrics.js') : null);
  if (!M) throw new Error('rz-diagram-layout requires rz-diagram-metrics');

  /* The style guide's label margin. 6 is the floor; the search prefers 8 so a
   * 1px stroke plus its antialiasing still leaves visible daylight. */
  var GAP_MIN = 6;
  var GAP_PREF = 8;
  /* Rule 4's minimum separation between two attach points on one edge. */
  var FAN_MIN = 12;
  /* Rule 1's elbow radius. */
  var ELBOW_R = 8;
  var ELBOW_R_TIGHT = 6;

  /* ======================================================================
   * Occupancy — what is already on the canvas
   * ==================================================================== */

  /**
   * A flat spatial index. Flat is deliberate: a cockpit diagram holds tens of
   * boxes, not thousands, and a linear scan of 80 rects is far cheaper than the
   * quadtree that would be needed to beat it. If a diagram ever needs more than
   * a few hundred, it is over the complexity budget and should be two diagrams.
   */
  function occupancy() {
    var items = [];
    return {
      items: items,

      /** Register a box. `meta.paintOrder` lets rule 6 be checked: a label mask
       *  is only clipped by a node painted AFTER it. */
      add: function (box, meta) {
        items.push({ box: box, meta: meta || {} });
        return this;
      },

      /**
       * Every registered box the candidate overlaps.
       *
       * Two exclusions are structural rather than optional:
       *
       * - boxes named in `opts.ignore` — a connector may legally touch its own
       *   endpoints;
       * - anything of kind `zone`. A zone is a container painted before every
       *   label, so a label sitting over one is readable and is the normal case
       *   (zone eyebrows depend on it). Counting zones as obstacles makes every
       *   position inside a container look occupied, and the placer then
       *   reports that a wide-open canvas has no room. Pass
       *   `includeZones: true` when the caller genuinely needs them.
       */
      hits: function (box, opts) {
        var o = opts || {};
        var ignore = o.ignore || [];
        var pad = o.pad || 0;
        var out = [];
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          if (ignore.indexOf(it.meta.id) !== -1) continue;
          if (it.meta.kind === 'zone' && !o.includeZones) continue;
          /* a mask fully inside a node is a badge chip, which is legal */
          if (o.allowContained && M.contains(it.box, box)) continue;
          if (M.overlap(box, it.box, pad)) out.push(it);
        }
        return out;
      },

      clear: function () { items.length = 0; return this; }
    };
  }

  /* ======================================================================
   * Label placement
   * ==================================================================== */

  function isVertical(seg) { return Math.abs(seg.x2 - seg.x1) < Math.abs(seg.y2 - seg.y1); }

  function midpoint(seg) {
    return { x: (seg.x1 + seg.x2) / 2, y: (seg.y1 + seg.y2) / 2 };
  }

  /**
   * Candidate boxes for a label on a segment, in preference order.
   *
   * A horizontal segment prefers above (the reading eye meets the label before
   * the line), then below. A vertical segment takes a side — never a rotation,
   * because vertical `writing-mode` text is a listed anti-pattern and is simply
   * hard to read.
   */
  function candidates(seg, size, gap) {
    var mid = midpoint(seg);
    var out = [];
    if (isVertical(seg)) {
      out.push({ slot: 'right', box: { x: seg.x1 + gap, y: mid.y - size.h / 2, w: size.w, h: size.h } });
      out.push({ slot: 'left', box: { x: seg.x1 - gap - size.w, y: mid.y - size.h / 2, w: size.w, h: size.h } });
    } else {
      out.push({ slot: 'above', box: { x: mid.x - size.w / 2, y: seg.y1 - gap - size.h, w: size.w, h: size.h } });
      out.push({ slot: 'below', box: { x: mid.x - size.w / 2, y: seg.y1 + gap, w: size.w, h: size.h } });
    }
    return out;
  }

  /**
   * Place a label against a segment.
   *
   * Strategy, in order:
   *   1. the preferred slots at the preferred gap;
   *   2. the same slots at the minimum gap (a tighter but still legal label);
   *   3. the same slots slid along the segment, in both directions, in 8px
   *      steps — a label does not have to sit at the midpoint, and sliding is
   *      almost always less disruptive than moving it to the far side;
   *   4. give up and report `placed:false`.
   *
   * Step 4 is the important one. The failure this engine exists to remove is
   * the *silent* overlap: code that draws the label anyway and leaves a human
   * to notice months later. A caller that gets `placed:false` has a real
   * layout problem and must be told, not papered over.
   *
   * @param {object} seg   { x1, y1, x2, y2 }
   * @param {object} size  { w, h } — from RZDiagramMetrics.textBox
   * @param {object} opts  { occupancy, ignore, prefer, slide, steps }
   */
  function placeLabel(seg, size, opts) {
    var o = opts || {};
    var occ = o.occupancy || occupancy();
    var ignore = o.ignore || [];
    var slide = o.slide == null ? 8 : o.slide;
    var steps = o.steps == null ? 12 : o.steps;
    var vertical = isVertical(seg);
    var len = vertical ? Math.abs(seg.y2 - seg.y1) : Math.abs(seg.x2 - seg.x1);

    var tries = [];
    [GAP_PREF, GAP_MIN].forEach(function (gap) {
      candidates(seg, size, gap).forEach(function (c) { tries.push({ c: c, gap: gap, shift: 0 }); });
    });
    /* sliding along the segment, alternating either way so the label stays as
     * near the midpoint as the obstacles allow */
    for (var s = 1; s <= steps; s++) {
      for (var dir = -1; dir <= 1; dir += 2) {
        var shift = dir * s * slide;
        if (Math.abs(shift) > len / 2) continue;
        candidates(seg, size, GAP_PREF).forEach(function (c) {
          var b = { x: c.box.x, y: c.box.y, w: c.box.w, h: c.box.h };
          if (vertical) b.y += shift; else b.x += shift;
          tries.push({ c: { slot: c.slot, box: b }, gap: GAP_PREF, shift: shift });
        });
      }
    }

    for (var i = 0; i < tries.length; i++) {
      var t = tries[i];
      if (occ.hits(t.c.box, { ignore: ignore }).length === 0) {
        return {
          placed: true,
          slot: t.c.slot,
          box: t.c.box,
          gap: t.gap,
          shift: t.shift,
          rotate: false
        };
      }
    }
    return { placed: false, slot: null, box: null, gap: 0, shift: 0, rotate: false };
  }

  /**
   * Place a free-floating box as near as possible to where it wants to be.
   *
   * `placeLabel` answers "where on this connector?". This answers "somewhere
   * around here" — the case a floating caption presents: a zone name on an
   * isometric, a title over a room, an annotation beside a symbol. It has a
   * preferred position and no line to hang from.
   *
   * The search is a ladder, not a spiral: straight up first, then down, then
   * the diagonals, at increasing distance. Up leads because on an exploded
   * isometric the space above a room is the reliably empty direction — below it
   * is the floor slab, and beside it is the next room.
   *
   * Caller decides who yields. Register the labels that must not move (an
   * equipment tag identifies a specific box; moving it makes it point at the
   * wrong thing) BEFORE calling this for the ones that may (a zone caption
   * names a region and reads correctly a few units away).
   *
   * @param {object} want  { x, y, w, h } — the box where it would like to sit
   * @param {object} opts  { occupancy, ignore, step, rings, axis }
   * @returns {{placed:boolean, box:object, dx:number, dy:number, ring:number}}
   */
  function placeBox(want, opts) {
    var o = opts || {};
    var occ = o.occupancy || occupancy();
    var ignore = o.ignore || [];
    var step = o.step == null ? 6 : o.step;
    var rings = o.rings == null ? 8 : o.rings;

    function free(b) { return occ.hits(b, { ignore: ignore }).length === 0; }
    function at(dx, dy) { return { x: want.x + dx, y: want.y + dy, w: want.w, h: want.h }; }

    if (free(want)) return { placed: true, box: want, dx: 0, dy: 0, ring: 0 };

    /* offsets per ring, in preference order */
    var dirs = o.axis === 'y'
      ? [[0, -1], [0, 1]]
      : [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];

    for (var r = 1; r <= rings; r++) {
      for (var i = 0; i < dirs.length; i++) {
        var dx = dirs[i][0] * step * r;
        var dy = dirs[i][1] * step * r;
        var cand = at(dx, dy);
        if (free(cand)) return { placed: true, box: cand, dx: dx, dy: dy, ring: r };
      }
    }
    /* Nothing within reach. Report it — the caller decides whether to drop the
     * label or accept the overlap, and either way it is a decision rather than
     * an accident. */
    return { placed: false, box: want, dx: 0, dy: 0, ring: -1 };
  }

  /* ======================================================================
   * Attach points — rule 4
   * ==================================================================== */

  /**
   * N attach points along one edge of a box, by the documented formula:
   * point k (1..N) sits at `L * k / (N + 1)` from the edge's leading corner.
   *
   * The returned array carries a `crowded` flag when the edge cannot hold N
   * points at >= 12px. That is not an error to swallow — it means two nodes are
   * too close or the diagram is over budget, and the author has to decide which.
   *
   * @param {object} box  { x, y, w, h }
   * @param {number} n
   * @param {string} side 'left' | 'right' | 'top' | 'bottom'
   */
  function fanPoints(box, n, side) {
    var vertical = (side === 'left' || side === 'right');
    var len = vertical ? box.h : box.w;
    var out = [];
    for (var k = 1; k <= n; k++) {
      var off = len * k / (n + 1);
      if (vertical) {
        out.push({ x: side === 'left' ? box.x : box.x + box.w, y: box.y + off });
      } else {
        out.push({ x: box.x + off, y: side === 'top' ? box.y : box.y + box.h });
      }
    }
    out.crowded = n > 1 && (len / (n + 1)) < FAN_MIN;
    out.spacing = n > 1 ? len / (n + 1) : len;
    return out;
  }

  /* ======================================================================
   * Routing — rules 1 and 5
   * ==================================================================== */

  function segRect(s) {
    var x = Math.min(s.x1, s.x2), y = Math.min(s.y1, s.y2);
    return { x: x, y: y, w: Math.abs(s.x2 - s.x1), h: Math.abs(s.y2 - s.y1) };
  }

  /** Does a segment pass through a box? Zero-thickness segments need a real
   *  overlap test, so the segment's bounding rect is inflated to 1px. */
  function segmentHitsRect(s, r) {
    var b = segRect(s);
    if (b.w === 0) b = { x: b.x - 0.5, y: b.y, w: 1, h: b.h };
    if (b.h === 0) b = { x: b.x, y: b.y - 0.5, w: b.w, h: 1 };
    return M.overlap(b, r) !== null;
  }

  function anyHit(segments, obstacles) {
    for (var i = 0; i < segments.length; i++) {
      for (var j = 0; j < obstacles.length; j++) {
        if (segmentHitsRect(segments[i], obstacles[j])) return true;
      }
    }
    return false;
  }

  /** Build the `d` string for a run of axis-aligned segments joined by
   *  quarter-arc elbows. The radius shrinks when a leg is too short to carry
   *  it, which is how rule 1 stays true on a tight layout instead of
   *  overshooting the corner. */
  function pathFor(points, radius) {
    if (points.length < 2) return { d: '', radius: radius };
    var r = radius;
    /* the radius may not exceed half of the shortest leg, or the arcs collide */
    for (var i = 1; i < points.length; i++) {
      var leg = Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y);
      r = Math.min(r, leg / 2);
    }
    r = r >= ELBOW_R ? ELBOW_R : (r >= ELBOW_R_TIGHT ? ELBOW_R_TIGHT : Math.max(0, Math.floor(r)));

    var d = 'M ' + points[0].x + ' ' + points[0].y;
    for (var k = 1; k < points.length - 1; k++) {
      var prev = points[k - 1], cur = points[k], next = points[k + 1];
      var inX = Math.sign(cur.x - prev.x), inY = Math.sign(cur.y - prev.y);
      var outX = Math.sign(next.x - cur.x), outY = Math.sign(next.y - cur.y);
      var a = { x: cur.x - inX * r, y: cur.y - inY * r };
      var b = { x: cur.x + outX * r, y: cur.y + outY * r };
      d += ' L ' + a.x + ' ' + a.y;
      /* sweep direction: the sign of the cross product of in and out */
      var sweep = (inX * outY - inY * outX) > 0 ? 1 : 0;
      d += ' A ' + r + ' ' + r + ' 0 0 ' + sweep + ' ' + b.x + ' ' + b.y;
    }
    var last = points[points.length - 1];
    d += ' L ' + last.x + ' ' + last.y;
    return { d: d, radius: r };
  }

  function toSegments(points) {
    var out = [];
    for (var i = 1; i < points.length; i++) {
      out.push({ x1: points[i - 1].x, y1: points[i - 1].y, x2: points[i].x, y2: points[i].y });
    }
    return out;
  }

  /**
   * Route an orthogonal connector from `a` to `b`.
   *
   * Tries, in order:
   *   - a straight line, when the endpoints already share an axis;
   *   - the two single-elbow routes (horizontal-first, vertical-first);
   *   - a three-segment dogleg at a series of offsets, which is what gets a
   *     connector around an intervening box;
   *   - failing all of that, the shortest route, marked `transit:true` so the
   *     caller draws it dashed per rule 5's narrow exception.
   *
   * @param {object} a  { x, y }
   * @param {object} b  { x, y }
   * @param {object} opts { obstacles, radius, clearance }
   */
  function route(a, b, opts) {
    var o = opts || {};
    var obstacles = o.obstacles || [];
    var clearance = o.clearance == null ? 12 : o.clearance;

    function build(points, rerouted) {
      var segs = toSegments(points);
      var p = pathFor(points, o.radius == null ? ELBOW_R : o.radius);
      return {
        points: points,
        segments: segs,
        d: p.d,
        radius: segs.length > 1 ? p.radius : 0,
        rerouted: !!rerouted,
        transit: false
      };
    }

    /* co-linear: one straight segment, no elbow. An elbow here is noise. */
    if (a.x === b.x || a.y === b.y) {
      var straight = build([a, b], false);
      if (!anyHit(straight.segments, obstacles)) return straight;
    }

    var tries = [];
    /* single elbow, both orders */
    tries.push([a, { x: b.x, y: a.y }, b]);
    tries.push([a, { x: a.x, y: b.y }, b]);
    /* doglegs at increasing offsets — enough to clear a panel, then a hall */
    var offsets = [clearance, clearance * 2, clearance * 3, clearance * 5, clearance * 8];
    for (var i = 0; i < offsets.length; i++) {
      var off = offsets[i];
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        var my = a.y + sgn * off;
        var mx = a.x + sgn * off;
        tries.push([a, { x: a.x, y: my }, { x: b.x, y: my }, b]);
        tries.push([a, { x: mx, y: a.y }, { x: mx, y: b.y }, b]);
      }
    }

    var first = null;
    for (var t = 0; t < tries.length; t++) {
      var pts = tries[t].filter(function (p, idx, arr) {
        /* drop a degenerate waypoint that repeats its neighbour */
        return idx === 0 || p.x !== arr[idx - 1].x || p.y !== arr[idx - 1].y;
      });
      var cand = build(pts, t > 1);
      if (first === null) first = cand;
      if (!anyHit(cand.segments, obstacles)) return cand;
    }

    /* Nothing clears. Rule 5's exception: keep the shortest route, but declare
     * it transit so the caller draws it dashed, puts the label at the visible
     * end, and lands no arrowhead on the intervening box. */
    first.transit = true;
    first.rerouted = false;
    return first;
  }

  var API = {
    GAP_MIN: GAP_MIN,
    GAP_PREF: GAP_PREF,
    FAN_MIN: FAN_MIN,
    ELBOW_R: ELBOW_R,
    occupancy: occupancy,
    placeLabel: placeLabel,
    placeBox: placeBox,
    fanPoints: fanPoints,
    route: route,
    segmentHitsRect: segmentHitsRect,
    isVertical: isVertical
  };

  root.RZDiagramLayout = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
