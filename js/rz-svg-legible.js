/* ============================================================================
 * RZ SVG LEGIBLE — hold a rendered floor for SVG label size, by scale, not by font
 * ----------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * `tools/audit-legibility.mjs` sets an 8.5 px floor on rendered SVG text, and datahallAI.html sat
 * in its MONITOR list — reported, never gating — carrying 503 findings. Measured per diagram, the
 * debt was not spread evenly and it was not a font problem:
 *
 *     rack / network / WAN / security / BMS   0 sub-floor labels   (10.8–11 px)   already clear
 *     fire mimic                              31 of 209            6.94 px        needs 1.23x
 *     building isometric                      42 of 200            6.17 px        needs 1.38x
 *     electrical SLD, per hall                309 of 316           4.74 px        needs 1.80x
 *     electrical overview                     306 of 333           4.42 px        needs 1.92x
 *     data hall plan                          136 of 202           3.89 px        needs 2.19x
 *     cooling P&ID                            493 of 524           3.70 px        needs 2.30x
 *
 * Five of fifteen diagrams were fine. The rest are DENSE, and the page already knew it: the
 * font-lift pass in datahallAI.html carries `FLOOR: 1` for hSvg, coolSvg and bldgSvg — a
 * deliberate no-op, because "they could NOT take any lift without a new overlap".
 *
 * THE MOVE THIS MODULE MAKES
 *
 * Raising a font enlarges one glyph inside geometry that did not move, which is why it collides.
 * Raising the SCALE enlarges the glyph AND the geometry together: an overlap cannot appear that
 * was not already there, because every distance in the drawing is multiplied by the same number.
 * So a diagram that cannot afford a bigger font can always afford a bigger drawing — the cost is
 * width, and width is what a scroll container is for. This is the same doctrine the CRAH rail on
 * datahall.html got in v1.134.26: hold a legible minimum and let it scroll, because a tag cut
 * mid-digit names a different unit and a label under the floor is texture, not information.
 *
 * The drawing SAYS SO. A diagram that scrolls without explanation reads as broken; one that
 * states "drawn at 2.3x so every label clears the 8.5 px floor" reads as a decision. That note is
 * not decoration — it is the provenance rule this site applies to numbers, applied to layout.
 *
 * WHAT IT WILL NOT DO
 *
 * - It never shrinks. A diagram already above the floor is left exactly as it was.
 * - It never exceeds `maxScale`. If the floor is unreachable inside that budget it applies what it
 *   can and reports the shortfall through `RZSvgLegible.report()` rather than pretending.
 * - It never edits a font-size, a coordinate or a viewBox. The only thing it sets is the rendered
 *   width of the <svg> and the wrapper that scrolls it, so it is safe on a drawing it has never
 *   seen and reversible by removing one attribute.
 * ==========================================================================*/
(function (root) {
  'use strict';
  if (root.RZSvgLegible) { return; }

  var FLOOR = 8.5;          /* tools/audit-legibility.mjs MIN_PX — one number, two places, stated */
  var MAX_SCALE = 2.6;      /* past this a pane is panning a poster, not showing a diagram */
  var MARK = 'data-rz-legible-scale';
  var registry = [];

  function px(el, scale) {
    var attr = el.getAttribute('font-size');
    if (attr) { return parseFloat(attr) * scale; }
    var computed = parseFloat(root.getComputedStyle(el).fontSize);
    return isFinite(computed) ? computed : Infinity;
  }

  /* The smallest label a reader can actually see. Hidden text and empty labels are not evidence. */
  function smallestLabel(svg, scale) {
    var nodes = svg.getElementsByTagName('text');
    var min = Infinity;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!(node.textContent || '').trim()) { continue; }
      var box = node.getBoundingClientRect();
      if (box.height <= 0) { continue; }
      var size = px(node, scale);
      if (size < min) { min = size; }
    }
    return min;
  }

  function viewBoxWidth(svg) {
    var vb = (svg.getAttribute('viewBox') || '').split(/\s+/);
    var width = parseFloat(vb[2]);
    return isFinite(width) && width > 0 ? width : 0;
  }

  /* The wrapper is created here rather than in markup so a page adopts by naming the diagram, not
     by restructuring around it. It is created once and reused on every later pass. */
  function scroller(svg) {
    var parent = svg.parentNode;
    if (parent && parent.getAttribute && parent.getAttribute('data-rz-legible-pane') !== null) {
      return parent;
    }
    var pane = svg.ownerDocument.createElement('div');
    pane.setAttribute('data-rz-legible-pane', '');
    pane.style.cssText = 'overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;scrollbar-width:thin;max-width:100%';
    parent.insertBefore(pane, svg);
    pane.appendChild(svg);
    return pane;
  }

  function note(pane, text) {
    var el = pane.querySelector('[data-rz-legible-note]');
    if (!text) { if (el) { el.remove(); } return; }
    if (!el) {
      el = pane.ownerDocument.createElement('div');
      el.setAttribute('data-rz-legible-note', '');
      /* The numbers in this note are drawing facts — the zoom this pane applied and the legibility
         floor it was measured against — not engine quantities. The strict coverage walker requires
         every rendered numeral to resolve to a registry value or carry a declared reason, and a
         scale factor has no registry value to resolve to. Declared here rather than at each call
         site so the note can never be emitted without it. */
      el.setAttribute('data-rz-authored-basis',
        'drawing scale note: the zoom factor this pane applied and the rendered-pixel legibility '
        + 'floor it was measured against are properties of the drawing, not published engine values');
      el.style.cssText = 'font:600 10px/1.4 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.02em;opacity:.62;padding:3px 2px 5px';
      pane.insertBefore(el, pane.firstChild);
    }
    el.textContent = text;
  }

  function fit(svg, options) {
    if (!svg || !svg.getBoundingClientRect) { return null; }
    var opts = options || {};
    var floor = opts.floor || FLOOR;
    var cap = opts.maxScale || MAX_SCALE;
    var vbWidth = viewBoxWidth(svg);
    if (!vbWidth) { return null; }

    var pane = scroller(svg);
    var available = pane.clientWidth || pane.getBoundingClientRect().width;
    if (!available) { return null; }

    /* Measure at 1:1 with the pane, so a previous pass never compounds into the next one. */
    svg.style.width = available + 'px';
    var rendered = svg.getBoundingClientRect().width || available;
    var scale = rendered / vbWidth;
    var smallest = smallestLabel(svg, scale);
    if (!isFinite(smallest) || smallest <= 0) { return null; }

    /* Aim a hair over the floor. A label that lands on 8.4999 px is reported as sub-floor by a
       gate comparing against 8.5, and sub-pixel rounding puts several of them there. */
    var want = (floor + 0.15) / smallest;
    var applied = Math.min(Math.max(want, 1), cap);
    var width = Math.round(available * applied);

    /* v3.6.5 — THE BUDGET IS A WIDTH, NOT A MULTIPLE.
     *
     * `maxScale` is a multiple of the PANE, and the floor is an absolute number of pixels, so the
     * multiple a diagram needs grows as the viewport shrinks: the data-hall plan wanted 3.11x at a
     * 1240 px pane, 3.84x at 1004 px and 9.8x on a phone — all of them the same ~3,840 px drawing.
     * A cap expressed as a multiple therefore fits one viewport and fails every other, which is
     * exactly what the survey found: clean on desktop and laptop, 944 sub-floor labels on tablet
     * and phone, from diagrams whose notes claimed a scale they had indeed applied.
     *
     * `minWidth` states the requirement in the units it is actually in. It OVERRIDES the cap, and
     * it has to: the cap is a guard against a runaway multiplier, while this is the measured width
     * at which the smallest label in THIS drawing crosses the floor. Where both are set the cap
     * still bounds anything the measurement did not anticipate. */
    if (opts.minWidth && width < opts.minWidth) {
      width = Math.round(opts.minWidth);
      applied = width / available;
    }
    svg.style.width = width + 'px';
    svg.style.maxWidth = 'none';
    svg.setAttribute(MARK, applied.toFixed(2));

    var reached = smallest * applied;
    var short = reached < floor - 0.01;
    if (opts.note !== false && applied > 1.01) {
      note(pane, short
        ? 'DRAWN AT ' + applied.toFixed(1) + '× — SCROLL TO PAN. SMALLEST LABEL ' + reached.toFixed(1)
            + ' PX, STILL UNDER THE ' + floor + ' PX FLOOR AT THIS CAP'
        : 'DRAWN AT ' + applied.toFixed(1) + '× SO EVERY LABEL CLEARS THE ' + floor + ' PX FLOOR — SCROLL TO PAN');
    } else {
      note(pane, null);
    }
    return { scale: applied, wanted: want, smallest: smallest, reached: reached, short: short, width: width };
  }

  /* A diagram is registered by SELECTOR, not by node: cockpit panels re-render on tab activation
     and on every engine tick, and a held node reference would be stale by the second pass. */
  function register(selector, options) {
    registry.push({ selector: selector, options: options || {} });
    apply(selector);
  }

  function apply(only) {
    var out = [];
    for (var i = 0; i < registry.length; i++) {
      var entry = registry[i];
      if (only && entry.selector !== only) { continue; }
      var svg = root.document.querySelector(entry.selector);
      if (!svg) { continue; }
      var box = svg.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) { continue; }   /* hidden panel — measured when shown */
      var result = fit(svg, entry.options);
      if (result) { out.push({ selector: entry.selector, scale: result.scale, smallest: result.smallest, reached: result.reached, short: result.short }); }
    }
    return out;
  }

  function report() { return apply(); }

  var pending = null;
  function schedule() {
    if (pending) { root.clearTimeout(pending); }
    pending = root.setTimeout(function () { pending = null; apply(); }, 120);
  }

  root.addEventListener('resize', schedule);
  /* Tab activation makes a hidden panel measurable for the first time; a class flip on the panel
     is the signal, and an observer costs nothing when nothing changes. */
  if (root.MutationObserver && root.document.body) {
    new root.MutationObserver(schedule).observe(root.document.body,
      { attributes: true, subtree: true, attributeFilter: ['class'] });
  }

  root.RZSvgLegible = { version: '1.0.0', FLOOR: FLOOR, register: register, apply: apply, fit: fit, report: report };
}(window));
