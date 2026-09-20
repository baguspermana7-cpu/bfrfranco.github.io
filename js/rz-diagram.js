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

  /* Stroke tiers, from documentation/design.md. Three weights, never four —
   * on a dark ground with no shadows, stroke weight is what carries hierarchy. */
  var TIER = { 1: 1.4, 2: 1.0, 3: 0.6 };

  /* Type ramp, from the resistancezero profile. */
  var TYPE = {
    'node-name': { size: 12, face: 'sans', weight: 600, tracking: 0 },
    sublabel: { size: 9, face: 'mono', weight: 400, tracking: 0 },
    eyebrow: { size: 8, face: 'mono', weight: 500, tracking: 0.18, upper: true },
    'arrow-label': { size: 8, face: 'mono', weight: 400, tracking: 0.06, upper: true },
    datum: { size: 11, face: 'mono', weight: 500, tracking: 0 },
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
        var lines = (o.name ? 1 : 0) + (o.sublabel ? 1 : 0) + (o.tag ? 1 : 0);
        var h = o.h || M.grid4(lines * 16 + pad);

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

        var cy = y + pad;
        if (o.tag) {
          ctx.text(o.tag, x + pad, cy + 7, { role: 'eyebrow', fill: o.stroke || 'soft' });
          cy += 14;
        }
        if (o.name) {
          ctx.text(o.name, x + w / 2, cy + 10, { role: 'node-name', anchor: 'middle', fill: o.nameFill || 'ink' });
          cy += 16;
        }
        if (o.sublabel) {
          ctx.text(o.sublabel, x + w / 2, cy + 8, { role: 'sublabel', anchor: 'middle', fill: 'soft' });
        }

        var box = { x: x, y: y, w: w, h: h };
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
        var dash = r.transit ? ' stroke-dasharray="4,3"' : (o.dashed ? ' stroke-dasharray="5,4"' : '');
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
