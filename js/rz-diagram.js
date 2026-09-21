/* ============================================================================
 * rz-diagram.js — the block-diagram surface the cockpit pages draw through
 * ----------------------------------------------------------------------------
 * The facade over rz-diagram-metrics.js (how wide is this?) and
 * rz-diagram-layout.js (where does it go, how does the line get there?).
 *
 * WHY THIS EXISTS
 *
 * Every cockpit diagram on this site is built by concatenating SVG strings with
 * coordinates typed by hand. That works exactly once. The moment a panel gains
 * a row, a title gains a word, or an engine value goes from 54 to 108, the
 * hand-typed coordinate is wrong — and nothing says so. The page renders, the
 * gate is not looking at that diagram, and a label sits on top of another label
 * until somebody reads it months later.
 *
 * Drawing through this module removes the class. A node is declared by its
 * content; the engine measures the content and sizes the box. A label is
 * declared against a connector; the engine searches for a position that
 * collides with nothing. A connector is declared by its endpoints; the engine
 * routes it orthogonally around whatever is in the way, and says so when it
 * cannot.
 *
 * DESIGN SYSTEM
 *
 * Geometry and structure follow the diagram-design skill (SKILL.md §5-§7) as
 * adopted by this project. The skin is the `resistancezero` profile in
 * ~/.diagram-design/profiles/, which overrides two of the skill's shipped
 * anti-patterns on purpose and documents why: this site is dark-native with an
 * ISA-18.2 alarm palette, and its data face is JetBrains Mono for the slashed
 * zero. Names still go in IBM Plex Sans; mono is still technical-only.
 *
 * Colours resolve to the CSS custom properties the cockpit pages already
 * define, never to hexes. One edit to a page's `:root` re-skins every diagram
 * on it, in both themes, with no change here.
 * ==========================================================================*/
(function (root) {
  'use strict';

  var M = root.RZDiagramMetrics;
  var L = root.RZDiagramLayout;
  if (!M || !L) throw new Error('rz-diagram requires rz-diagram-metrics and rz-diagram-layout');

  /* ======================================================================
   * Tokens — semantic role to the page's own custom property
   * ==================================================================== */
  var TOKENS = {
    paper: 'var(--bg1)',
    'paper-2': 'var(--bg3)',
    ink: 'var(--t1)',
    muted: 'var(--t2)',
    soft: 'var(--t3)',
    rule: 'var(--bd)',
    'rule-solid': 'var(--bd2)',
    accent: 'var(--o)',
    link: 'var(--c)',
    /* ISA-18.2 channels. These are states, not a series palette: a node is
     * amber because it is in caution, never because it is the third item. */
    'alarm-caution': 'var(--o)',
    'alarm-normal': 'var(--g)',
    'alarm-fault': 'var(--r)',
    'alarm-info': 'var(--c)'
  };

  /** Resolve a semantic role, or pass a literal through unchanged. */
  function tok(name) {
    return Object.prototype.hasOwnProperty.call(TOKENS, name) ? TOKENS[name] : name;
  }

  /* ======================================================================
   * Stroke patterns — the SECOND channel
   * ====================================================================
   * WCAG 1.4.1 (Use of Color): colour may never be the only visual means of
   * conveying information. A diagram that separates supply from return by hue
   * alone disappears for a reader with colour-vision deficiency, in greyscale
   * print, and in this site's own PDF export.
   *
   * So every semantic class carries a pattern as well as a hue, and the engine
   * refuses to let two classes differ by hue alone (see the redundancy check in
   * legend()). These are named rather than raw dasharrays so the legend can say
   * what they mean.
   */
  /* Every option node() honours. Anything else is a typo — see the check in
   * node() for why that matters. */
  var NODE_OPTS = ['id', 'tag', 'name', 'sublabel', 'w', 'h', 'pad', 'stroke', 'fill',
                   'tier', 'dashed', 'focal', 'radius', 'legend', 'vAlign', 'nameFill'];

  var PATTERN = {
    solid: '',
    dashed: '6,4',
    dotted: '1.5,3',
    'dash-dot': '8,3,1.5,3'
  };

  /* Stroke tiers, from documentation/design.md. Three weights, never four —
   * on a dark ground with no shadows, stroke weight is what carries hierarchy. */
  var TIER = { 1: 1.4, 2: 1.0, 3: 0.6 };

  /* Type ramp, from the resistancezero profile. */
  var TYPE = {
    'node-name': { size: 12, face: 'sans', weight: 600, tracking: 0 },
    sublabel: { size: 9, face: 'mono', weight: 400, tracking: 0 },
    /* v3.10.19 — 9, not 8. These two tiers are the smallest type the engine emits, and at 8
       they render at exactly 8px against `audit-legibility.mjs`'s 8.5px floor: every figure
       drawn with an eyebrow or an arrow label failed the gate the moment it shipped
       (article-10 did, in bbd8ce4e). The type ramp and the legibility floor are both this
       repository's own standards and they disagreed; the floor wins, because it is the one
       measured against a rendered page. 9 is already `sublabel`'s size, so the ramp keeps
       three distinct steps below `datum`. */
    eyebrow: { size: 9, face: 'mono', weight: 500, tracking: 0.18, upper: true },
    'arrow-label': { size: 9, face: 'mono', weight: 400, tracking: 0.06, upper: true },
    datum: { size: 11, face: 'mono', weight: 500, tracking: 0 },
    /* Legend entries are prose, not values, so they take the sans face. They
     * used to borrow `sublabel`, which is MONO — and the width was budgeted in
     * sans, so every entry rendered about 13 % wider than it was measured and
     * the strip overlapped itself. */
    'legend-label': { size: 9, face: 'sans', weight: 400, tracking: 0 },
    title: { size: 14, face: 'sans', weight: 600, tracking: -0.02 }
  };

  var FAMILY = {
    sans: "'IBM Plex Sans', system-ui, sans-serif",
    mono: "'JetBrains Mono', 'SF Mono', monospace"
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ======================================================================
   * Drawing context
   * ==================================================================== */

  /**
   * @param {object} spec { width, height, title, desc, slug }
   *
   * `title` and `desc` are not optional decoration — they are the accessible
   * figure contract (SKILL.md §12). `<title>` must be the first child of the
   * SVG, and the ids must be slug-prefixed so two inline diagrams on one page
   * cannot announce each other's name.
   */
  function create(spec) {
    var s = spec || {};
    var W = s.width || 960;
    var H = s.height || 600;
    var slug = s.slug || 'rzd';

    var occ = L.occupancy();
    /* three paint layers, emitted in this order: zones sit behind everything,
     * connectors behind nodes, labels last so nothing can clip them. The
     * shipped skill paints labels BEFORE nodes and then needs a verifier to
     * catch masks that land under a node; painting labels last removes the
     * failure mode instead of detecting it. */
    var layers = { zones: [], edges: [], nodes: [], labels: [] };
    var warnings = [];
    var seq = 0;
    /* What was actually drawn, so the legend is DERIVED rather than typed. A
     * legend that lists an entry the drawing does not contain is noise; one that
     * omits a treatment the drawing uses is worse. Neither can happen if the
     * drawing writes the legend. */
    var drawn = { nodes: [], edges: [] };
    var nodeCount = 0;

    function id(prefix) { return slug + '-' + prefix + (++seq); }

    var ctx = {
      width: W,
      height: H,
      occupancy: occ,
      warnings: warnings,

      /* ---- zones ------------------------------------------------------ */
      /** A container: a boundary plus an eyebrow. Painted first, so a label
       *  over a zone is legal and readable. */
      zone: function (x, y, w, h, o) {
        o = o || {};
        var stroke = tok(o.stroke || 'rule-solid');
        var fill = o.fill ? tok(o.fill) : 'none';
        var r = o.radius == null ? 8 : o.radius;
        layers.zones.push(
          '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
          '" rx="' + r + '" fill="' + fill + '" stroke="' + stroke +
          '" stroke-width="' + (TIER[o.tier || 1]) + '"' +
          (o.dashed ? ' stroke-dasharray="4,4"' : '') + '/>');
        if (o.label) {
          ctx.text(o.label, x + 12, y + 14, { role: 'eyebrow', fill: o.labelFill || 'soft' });
        }
        occ.add({ x: x, y: y, w: w, h: h }, { id: o.id || id('zone'), kind: 'zone' });
        return ctx;
      },

      /* ---- nodes ------------------------------------------------------ */
      /**
       * A node sized from its own content.
       *
       * The width is measured, not guessed: the widest of name, sublabel and
       * tag, plus padding, rounded up to the 4px grid. Pass `w` to override,
       * and the engine warns if the content does not fit — which is the CDU
       * header bug (a 148-unit bar carrying a ~170-unit title) turned into a
       * message instead of a silent overrun.
       */
      node: function (x, y, o) {
        o = o || {};
        /* An unknown option is a typo, and a silently dropped one is the worst
         * kind: `sub` instead of `sublabel` cost a node its second line with
         * nothing logged and nothing thrown — the figure simply came out
         * missing a fact. Name what is accepted, and say so when something else
         * arrives. */
        for (var k in o) {
          if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
          if (NODE_OPTS.indexOf(k) === -1) {
            warnings.push({
              kind: 'unknown-option', id: o.id || o.name,
              message: 'node option "' + k + '" is not recognised and was ignored; ' +
                       'accepted options are ' + NODE_OPTS.join(', ')
            });
          }
        }
        var pad = o.pad == null ? 12 : o.pad;
        var nameW = o.name ? M.textWidth(o.name, TYPE['node-name'].size, 'sans') : 0;
        var subW = o.sublabel ? M.textWidth(o.sublabel, TYPE.sublabel.size, 'mono') : 0;
        var tagW = o.tag ? M.textWidth(o.tag, TYPE.eyebrow.size, 'mono', { tracking: 0.18 }) + 10 : 0;
        var need = M.grid4(Math.max(nameW, subW, tagW) + pad * 2);
        var w = o.w || need;
        if (o.w && need > o.w) {
          warnings.push({
            kind: 'node-overflow', id: o.id || o.name,
            message: '"' + o.name + '" needs ' + need + ' units, box is ' + o.w
          });
        }
        /* Height, measured the same way width is. The tag chip is 18 tall, a
         * name line 16, a sublabel 14, plus padding top and bottom.
         *
         * This used to trust o.h without checking it, while the width path
         * warned — an asymmetry that let a caller force h:52 onto a node
         * needing 64 and get a sublabel drawn across its own bottom border. A
         * box too short clips its text exactly as a box too narrow does. */
        var needH = M.grid4((o.tag ? 18 : 0) + (o.name ? 16 : 0) +
                            (o.sublabel ? 14 : 0) + pad * 2);
        var h = o.h || needH;
        if (o.h && needH > o.h) {
          warnings.push({
            kind: 'node-overflow', id: o.id || o.name,
            message: '"' + (o.name || o.id) + '" needs ' + needH +
                     ' units of height, box is ' + o.h + ' — its text will cross its own border'
          });
        }
        /* A vessel drawn tall to span its ports should not wear its label like
         * a hat. Centre the block when the box is much taller than its text. */
        var vPad = (o.vAlign === 'middle' || (o.h && o.h > needH + 24))
          ? Math.round((h - (needH - pad * 2)) / 2) - pad
          : 0;

        var stroke = tok(o.stroke || (o.focal ? 'accent' : 'rule-solid'));
        var fill = tok(o.fill || (o.focal ? 'paper-2' : 'paper'));
        var r = o.radius == null ? 6 : o.radius;

        var g = [];
        /* opaque mask first so a connector cannot bleed through a tinted fill */
        g.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
               '" rx="' + r + '" fill="' + tok('paper') + '"/>');
        g.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
               '" rx="' + r + '" fill="' + fill + '" stroke="' + stroke +
               '" stroke-width="' + TIER[o.tier || 2] + '"' +
               (o.dashed ? ' stroke-dasharray="4,3"' : '') + '/>');
        layers.nodes.push(g.join(''));

        var cy = y + pad + (vPad > 0 ? vPad : 0);
        if (o.tag) {
          /* A type tag is a rectangular chip at rx=2, never a pill and never bare
           * text: the outline is what separates a classification from a label.
           * Its width is measured from the tag itself, so a three-letter tag and
           * a six-letter one each get a box that fits. */
          var tagTxt = String(o.tag).toUpperCase();
          var tw = M.textWidth(tagTxt, TYPE.eyebrow.size, 'mono', { tracking: TYPE.eyebrow.tracking });
          var tagBoxW = Math.round(tw + 10);
          layers.nodes.push(
            '<rect x="' + (x + pad) + '" y="' + cy + '" width="' + tagBoxW +
            '" height="12" rx="2" fill="none" stroke="' + stroke +
            '" stroke-width="0.8" opacity="0.5"/>');
          ctx.text(tagTxt, x + pad + tagBoxW / 2, cy + 8.5,
            { role: 'eyebrow', anchor: 'middle', fill: o.stroke || 'soft' });
          cy += 18;
        }
        if (o.name) {
          ctx.text(o.name, x + w / 2, cy + 10, { role: 'node-name', anchor: 'middle', fill: o.nameFill || 'ink' });
          cy += 16;
        }
        if (o.sublabel) {
          ctx.text(o.sublabel, x + w / 2, cy + 8, { role: 'sublabel', anchor: 'middle', fill: 'soft' });
        }

        var box = { x: x, y: y, w: w, h: h };
        /* Complexity budget. Miller's ~7±2 is why the skill caps a diagram at
         * nine nodes: past that a reader stops seeing a structure and starts
         * reading a list, and the answer is two diagrams, not a bigger one.
         * Reported once, with the count, rather than on every node after. */
        nodeCount++;
        if (nodeCount === 10) {
          warnings.push({
            kind: 'over-budget',
            message: 'this diagram now has 10 nodes; the budget is 9. Past that the reader ' +
                     'stops seeing a structure and starts reading a list — split it into an ' +
                     'overview and a detail rather than making this one bigger'
          });
        }
        if (o.legend) {
          drawn.nodes.push({ legend: o.legend, stroke: o.stroke || (o.focal ? 'accent' : 'rule-solid'),
                             fill: o.fill || 'paper', dashed: !!o.dashed });
        }
        occ.add(box, { id: o.id || id('node'), kind: 'node' });
        return box;
      },

      /* ---- text ------------------------------------------------------- */
      /**
       * Place text at an explicit point. The box is registered so later
       * placements can see it — which is what makes automatic placement work
       * for the elements that come after.
       */
      text: function (str, x, y, o) {
        o = o || {};
        var t = TYPE[o.role || 'sublabel'];
        var content = t.upper ? String(str).toUpperCase() : String(str);
        var box = M.textBox(content, {
          x: x, y: y, size: o.size || t.size, face: t.face,
          anchor: o.anchor || 'start', tracking: t.tracking
        });
        layers.labels.push(
          '<text x="' + x + '" y="' + y + '" fill="' + tok(o.fill || 'muted') +
          '" font-family="' + FAMILY[t.face] + '" font-size="' + (o.size || t.size) +
          '" font-weight="' + t.weight + '"' +
          (t.tracking ? ' letter-spacing="' + t.tracking + 'em"' : '') +
          (o.anchor ? ' text-anchor="' + o.anchor + '"' : '') +
          (t.face === 'mono' ? ' style="font-variant-numeric:tabular-nums"' : '') +
          '>' + esc(content) + '</text>');
        occ.add(box, { id: o.id || id('text'), kind: 'text' });
        return box;
      },

      /* ---- ports ------------------------------------------------------- */
      /**
       * Attach points along one edge of a node, per connector rule 4.
       *
       * This wraps RZDiagramLayout.fanPoints only to READ its `crowded` flag.
       * The flag was computed from the start and nothing consumed it, so a node
       * 56 units tall could carry five connectors at 9-unit spacing — under the
       * 12-unit minimum — and the only symptom was a drawing whose lines
       * bunched and detoured. A computed warning nobody reads is not a warning.
       */
      ports: function (box, n, side, o) {
        var pts = L.fanPoints(box, n, side);
        if (pts.crowded) {
          warnings.push({
            kind: 'ports-crowded',
            id: (o && o.id) || '',
            message: n + ' connectors on a ' +
                     ((side === 'left' || side === 'right') ? box.h : box.w) +
                     '-unit edge leaves ' + pts.spacing.toFixed(1) +
                     ' units between them; rule 4 wants at least ' + L.FAN_MIN +
                     '. Make the node taller, or send fewer connectors to one edge'
          });
        }
        return pts;
      },

      /* ---- connectors ------------------------------------------------- */
      /**
       * An orthogonal connector, routed around whatever is registered.
       *
       * `obstacles` defaults to every registered node and zone except the two
       * endpoints, which is the behaviour SKILL.md §6 rule 5 asks for: reroute
       * by default, and only cross when crossing is unavoidable — in which case
       * the stroke comes back dashed and `transit` is set.
       */
      edge: function (from, to, o) {
        o = o || {};
        var ignore = (o.ignore || []).concat([o.fromId, o.toId]).filter(Boolean);
        var obstacles = o.obstacles || occ.items
          .filter(function (it) {
            return it.meta.kind === 'node' && ignore.indexOf(it.meta.id) === -1;
          })
          .map(function (it) { return it.box; });

        var r = L.route(from, to, { obstacles: obstacles, clearance: o.clearance });
        var stroke = tok(o.stroke || 'muted');
        /* `pattern` is the second channel. A transit stroke is always dashed —
         * that is rule 5's signal and it outranks the caller's choice. */
        var pat = r.transit ? 'dashed' : (o.pattern || (o.dashed ? 'dashed' : 'solid'));
        var dash = PATTERN[pat] ? ' stroke-dasharray="' + PATTERN[pat] + '"' : '';
        if (o.legend) {
          drawn.edges.push({ legend: o.legend, stroke: o.stroke || 'muted', pattern: pat });
        }
        layers.edges.push(
          '<path d="' + r.d + '" fill="none" stroke="' + stroke +
          '" stroke-width="' + TIER[o.tier || 2] + '"' + dash +
          (o.marker === false || r.transit ? '' : ' marker-end="url(#' + slug + '-arrow)"') +
          ' data-rzd-transit="' + (r.transit ? '1' : '0') +
          '" data-rzd-rerouted="' + (r.rerouted ? '1' : '0') + '"/>');

        if (r.transit) {
          warnings.push({
            kind: 'transit', message: 'connector crosses a non-endpoint box; drawn dashed'
          });
        }

        if (o.label) {
          /* label the segment that has room; on a transit route, label the
           * visible end (the first segment), per rule 5 */
          var seg = r.transit ? r.segments[0] : r.segments[Math.floor(r.segments.length / 2)];
          var t = TYPE['arrow-label'];
          var content = String(o.label).toUpperCase();
          var size = { w: M.textWidth(content, t.size, 'mono', { tracking: t.tracking }) + 6,
                       h: M.textHeight(t.size) + 4 };
          var p = L.placeLabel(seg, size, { occupancy: occ });
          if (p.placed) {
            layers.labels.push(
              '<rect x="' + p.box.x + '" y="' + p.box.y + '" width="' + p.box.w +
              '" height="' + p.box.h + '" rx="2" fill="' + tok('paper') + '"/>');
            ctx.text(content, p.box.x + p.box.w / 2, p.box.y + p.box.h - 4,
              { role: 'arrow-label', anchor: 'middle', fill: o.labelFill || 'soft' });
          } else {
            warnings.push({
              kind: 'label-unplaced', message: 'no clear position for arrow label "' + o.label + '"'
            });
          }
        }
        return r;
      },

      /* ---- legend ------------------------------------------------------ */
      /**
       * Draw the legend from what was actually drawn.
       *
       * Three rules the skill states and this makes structural rather than
       * hopeful:
       *
       *   - the legend covers every treatment used and nothing else. It cannot
       *     drift, because the drawing wrote it.
       *   - it is a horizontal strip at the foot, never floating inside the
       *     diagram area where it would collide with nodes.
       *   - no two entries may differ by COLOUR ALONE. That is WCAG 1.4.1, and
       *     it is also just legibility: a reader with colour-vision deficiency,
       *     a greyscale print and this site's PDF export all lose a hue-only
       *     distinction. The engine reports it rather than drawing it.
       *
       * Call after the last node and edge; it places itself below everything.
       */
      legend: function (o) {
        o = o || {};
        var items = [];
        var seen = {};
        function push(kind, e) {
          var key = kind + '|' + e.legend;
          if (seen[key]) return;
          seen[key] = 1;
          items.push({ kind: kind, legend: e.legend, stroke: e.stroke,
                       pattern: e.pattern, fill: e.fill, dashed: e.dashed });
        }
        drawn.nodes.forEach(function (n) { push('node', n); });
        drawn.edges.forEach(function (e) { push('edge', e); });
        if (!items.length) return ctx;

        /* One label, one meaning. The demo shipped "Air side, 15 %" on both a
         * node swatch and a line, which reads as one entry drawn twice rather
         * than two different things — the box is the air handlers, the line is
         * the heat path. Same text on two channels is a defect. */
        var byText = {};
        items.forEach(function (i) { (byText[i.legend] = byText[i.legend] || []).push(i.kind); });
        Object.keys(byText).forEach(function (txt) {
          if (byText[txt].length > 1) {
            warnings.push({
              kind: 'legend-duplicate',
              message: '"' + txt + '" labels both a ' + byText[txt].join(' and a ') +
                       ' — one label must mean one thing; name them separately'
            });
          }
        });

        /* redundancy check, per channel kind */
        ['node', 'edge'].forEach(function (kind) {
          var group = items.filter(function (i) { return i.kind === kind; });
          for (var i = 0; i < group.length; i++) {
            for (var j = i + 1; j < group.length; j++) {
              var a = group[i], b = group[j];
              var sameShape = kind === 'edge'
                ? a.pattern === b.pattern
                : (!!a.dashed === !!b.dashed && a.fill === b.fill);
              if (sameShape && a.stroke !== b.stroke) {
                warnings.push({
                  kind: 'colour-only',
                  message: '"' + a.legend + '" and "' + b.legend + '" differ only by colour — ' +
                           'give one of them a different ' +
                           (kind === 'edge' ? 'pattern' : 'fill or outline') +
                           ' so the distinction survives greyscale and colour-vision deficiency'
                });
              }
            }
          }
        });

        /* geometry: a strip under everything drawn so far */
        var maxY = 0, maxX = 0;
        occ.items.forEach(function (it) {
          if (it.box.y + it.box.h > maxY) maxY = it.box.y + it.box.h;
          if (it.box.x + it.box.w > maxX) maxX = it.box.x + it.box.w;
        });
        var left = o.x == null ? 32 : o.x;
        var top = M.grid4(maxY + (o.gap == null ? 48 : o.gap));
        var right = Math.max(maxX, left + 200);

        layers.labels.push('<line x1="' + left + '" y1="' + top + '" x2="' + right +
          '" y2="' + top + '" stroke="' + tok('rule') + '" stroke-width="0.8"/>');
        ctx.text('LEGEND', left, top + 16, { role: 'eyebrow', fill: 'soft' });

        var lx = left;
        var ly = top + 34;
        items.forEach(function (it) {
          var w = M.textWidth(it.legend, TYPE['legend-label'].size,
                              TYPE['legend-label'].face) + 26;
          /* wrap rather than run off the sheet — a legend that leaves the page
           * is the same defect as a label that does */
          if (lx > left && lx + w > right) { lx = left; ly += 22; }
          if (it.kind === 'node') {
            layers.labels.push('<rect x="' + lx + '" y="' + (ly - 8) + '" width="14" height="10" rx="2" fill="' +
              (it.fill ? tok(it.fill) : 'none') + '" stroke="' + tok(it.stroke) +
              '" stroke-width="1.4"' + (it.dashed ? ' stroke-dasharray="3,2"' : '') + '/>');
          } else {
            var d = PATTERN[it.pattern] ? ' stroke-dasharray="' + PATTERN[it.pattern] + '"' : '';
            layers.labels.push('<line x1="' + lx + '" y1="' + (ly - 3) + '" x2="' + (lx + 16) +
              '" y2="' + (ly - 3) + '" stroke="' + tok(it.stroke) + '" stroke-width="1.4"' + d + '/>');
          }
          /* Advance from the box the text ACTUALLY registered, never from a
           * second measurement of the same string: two measurements can
           * disagree, and this one did — sans here, mono in the renderer. */
          var tb = ctx.text(it.legend, lx + 22, ly, { role: 'legend-label', fill: 'muted' });
          lx = tb.x + tb.w + 22;
        });
        return ctx;
      },

      /* ---- output ----------------------------------------------------- */
      /**
       * Shrink the frame to what was actually drawn, plus `pad`.
       *
       * A viewBox is normally typed in advance and then defended — the content
       * grows, the frame does not, and labels start falling off the right edge
       * (or, as here, 150 units of dead canvas squash the diagram when the SVG
       * is scaled to its pane). Calling this after the last element lets the
       * frame follow the content instead.
       */
      fit: function (pad) {
        var p = pad == null ? 24 : pad;
        if (!occ.items.length) return ctx;
        var maxX = 0, maxY = 0;
        for (var i = 0; i < occ.items.length; i++) {
          var b = occ.items[i].box;
          if (b.x + b.w > maxX) maxX = b.x + b.w;
          if (b.y + b.h > maxY) maxY = b.y + b.h;
        }
        W = ctx.width = M.grid4(maxX + p);
        H = ctx.height = M.grid4(maxY + p);
        return ctx;
      },

      render: function () {
        var out = [];
        out.push('<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="' +
                 slug + '-title ' + slug + '-desc" preserveAspectRatio="xMidYMid meet">');
        out.push('<title id="' + slug + '-title">' + esc(s.title || 'Diagram') + '</title>');
        out.push('<desc id="' + slug + '-desc">' + esc(s.desc || '') + '</desc>');
        out.push('<defs><marker id="' + slug + '-arrow" markerWidth="8" markerHeight="6" ' +
                 'refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="' +
                 tok('muted') + '"/></marker></defs>');
        out.push('<rect width="' + W + '" height="' + H + '" fill="' + tok('paper') + '"/>');
        out.push(layers.zones.join(''));
        out.push(layers.edges.join(''));
        out.push(layers.nodes.join(''));
        out.push(layers.labels.join(''));
        out.push('</svg>');
        return out.join('');
      }
    };

    return ctx;
  }

  var API = {
    create: create,
    TOKENS: TOKENS,
    TIER: TIER,
    TYPE: TYPE,
    token: tok,
    metrics: M,
    layout: L
  };

  root.RZDiagram = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
