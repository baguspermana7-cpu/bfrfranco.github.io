/* ============================================================================
 * rz-diagram-metrics.js — how wide is this label, before we draw it?
 * ----------------------------------------------------------------------------
 * Every collision on this site's cockpit diagrams has the same root cause: the
 * page draws a label without knowing how wide it is. A title is centred in a
 * 148-unit header bar and turns out to be 170 wide; a parameter panel is sized
 * for four rows and grows to six; two blocks are both pinned to the same corner
 * because neither one measured the other. The drawing code had no way to ask.
 *
 * This module is the answer to that question, and it is deliberately the
 * simplest thing that can be right: a per-character width budget, taken from
 * the diagram-design style guide (profile `resistancezero`).
 *
 *   Every Unicode wide or full-width character costs 1em.
 *   Every other character costs its face's Latin advance.
 *   Nonspacing and enclosing marks cost nothing.
 *
 * Counting by script is the trap the style guide names: `주문 v2.1` is two
 * full-width syllables and five narrow characters, and a formula that tallies
 * "Hangul plus Latin letters plus spaces" silently drops `2`, `.` and `1`, then
 * sizes the box for four of its seven characters. Measure per character.
 *
 * The budget is an estimate for a proportional face and exact for a monospaced
 * one. It is allowed to be slightly loose — a box 3px wider than its text is
 * invisible; a box 3px narrower clips a glyph. It is never allowed to be tight.
 *
 * Usable in the browser (attaches to window) and under Node `vm` (attaches to
 * globalThis), with no DOM dependency at all — which is what lets the ship gate
 * assert the same numbers the page draws.
 * ==========================================================================*/
(function (root) {
  'use strict';

  /* ---- faces -------------------------------------------------------------
   * Latin advance per character, in em. Both are narrower than the Geist
   * figures the shipped style guide assumes (0.60 / 0.62), so a box sized with
   * the default budget comes out loose rather than clipped.
   *
   * JetBrains Mono is monospaced, so 0.60 is exact, not an average. IBM Plex
   * Sans is proportional and 0.58 is its mixed-case average: `MMMM` overruns it
   * and `iiii` undershoots. Capitals-heavy labels get a nudge below.
   * --------------------------------------------------------------------- */
  var FACES = {
    sans: { advance: 0.58, monospaced: false, family: "'IBM Plex Sans', system-ui, sans-serif" },
    mono: { advance: 0.60, monospaced: true, family: "'JetBrains Mono', 'SF Mono', monospace" }
  };

  /* Uppercase and the wide Latin letters cost more than the mixed-case average.
   * Eyebrows and arrow labels on this site are all-caps by convention, so this
   * correction is not an edge case — it is the common path. */
  var WIDE_LATIN = /[A-Z0-9@#%&WM]/;
  var NARROW_LATIN = /[ilj.,:;'`!|\[\]()\/\\ ]/;

  /* East Asian Wide + Fullwidth ranges. Not the full UAX #11 table — the ranges
   * a diagram on this site can actually contain (CJK, Hangul, Kana, fullwidth
   * forms, and the CJK punctuation that travels with them). */
  var WIDE_RANGES = [
    [0x1100, 0x115F], [0x2E80, 0x303E], [0x3041, 0x33FF],
    [0x3400, 0x4DBF], [0x4E00, 0x9FFF], [0xA000, 0xA4CF],
    [0xAC00, 0xD7A3], [0xF900, 0xFAFF], [0xFE30, 0xFE4F],
    [0xFF00, 0xFF60], [0xFFE0, 0xFFE6]
  ];

  function isWide(cp) {
    for (var i = 0; i < WIDE_RANGES.length; i++) {
      if (cp >= WIDE_RANGES[i][0] && cp <= WIDE_RANGES[i][1]) return true;
    }
    return false;
  }

  /* Nonspacing (Mn) and enclosing (Me) marks advance the pen by nothing: they
   * stack on the previous glyph. `e` + U+0301 is one character wide, not two. */
  var COMBINING = /[̀-ͯ҃-҉֑-ֽؐ-ًؚ-ٰٟۖ-ܑۜܰ-݊ަ-ްࠖ-࠙ࠛ-ࠣࠥ-ࠧࠩ-࡙࠭-࡛ࣣ-ःऺ-़ा-ॏ॑-ॗॢॣัิ-ฺ็-๎᪰-᫿᷀-᷿⃐-⃰︀-️︠-︯]/;

  /* ---- the budget ------------------------------------------------------ */

  /**
   * Cost of one character, in em.
   * @param {string} ch  a single character (not a code point pair)
   * @param {object} face  an entry from FACES
   */
  function advanceOf(ch, face) {
    if (COMBINING.test(ch)) return 0;
    var cp = ch.codePointAt(0);
    if (isWide(cp)) return 1;
    if (face.monospaced) return face.advance;
    /* proportional correction — only for the two classes that actually move
     * the number enough to clip or to waste a column */
    if (WIDE_LATIN.test(ch)) return face.advance * 1.12;
    if (NARROW_LATIN.test(ch)) return face.advance * 0.55;
    return face.advance;
  }

  /**
   * Width of a string, in px.
   * @param {string} text
   * @param {number} size      font-size in px (or user units, in an SVG)
   * @param {string} faceName  'sans' | 'mono'
   * @param {object} [opts]    { tracking } — letter-spacing in em, as authored
   *                           in the style guide (eyebrows are 0.18em)
   */
  function textWidth(text, size, faceName, opts) {
    if (text == null) return 0;
    var face = FACES[faceName] || FACES.sans;
    var o = opts || {};
    var str = String(text);
    var em = 0;
    var counted = 0;
    /* iterate by code point so an astral character is one character, not two */
    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      var cp = str.codePointAt(i);
      if (cp > 0xFFFF) { ch = str.substr(i, 2); i++; }
      var a = advanceOf(ch, face);
      em += a;
      if (a > 0) counted++;
    }
    /* Tracking is applied between and after glyphs by every SVG renderer, so
     * an N-character tracked label is N tracking units wider, not N-1. This is
     * why a tracked eyebrow overruns a box sized from its untracked twin. */
    if (o.tracking) em += o.tracking * counted;
    return em * size;
  }

  /** Height of a single line, in px. Cap height plus descender, not leading. */
  function textHeight(size) {
    return size * 1.15;
  }

  /**
   * The box a `<text>` element will occupy.
   * @param {string} text
   * @param {object} o  { x, y, size, face, anchor, tracking, baseline }
   *   `anchor`   — 'start' | 'middle' | 'end', matching SVG text-anchor
   *   `baseline` — how far above y the box top sits, as a fraction of size.
   *                0.8 matches a dominant-baseline of alphabetic, which is what
   *                every `tx()` call site on this site uses.
   * @returns {{x:number,y:number,w:number,h:number}}
   */
  function textBox(text, o) {
    o = o || {};
    var size = o.size || 12;
    var w = textWidth(text, size, o.face || 'sans', { tracking: o.tracking });
    var h = textHeight(size);
    var anchor = o.anchor || 'start';
    var x = o.x || 0;
    if (anchor === 'middle') x -= w / 2;
    else if (anchor === 'end') x -= w;
    var lift = o.baseline == null ? 0.8 : o.baseline;
    return { x: x, y: (o.y || 0) - size * lift, w: w, h: h };
  }

  /* ---- box algebra ------------------------------------------------------ */

  /** Round UP to the 4px structural grid. Never down: down clips. */
  function grid4(n) {
    return Math.ceil(n / 4) * 4;
  }

  function rect(x, y, w, h) { return { x: x, y: y, w: w, h: h }; }

  /**
   * Overlap between two boxes, reported per axis.
   *
   * Returning a boolean is what made today's fixes expensive: two attempts were
   * spent nudging a label DOWN when the overlap was 27px horizontal and 2px
   * vertical, so the vertical lever could never clear it. `axis` names the
   * cheaper direction to separate in — the one with the SMALLER overlap, since
   * that is the shorter distance to move.
   *
   * @returns {null | {ox:number, oy:number, axis:'x'|'y', area:number}}
   */
  function overlap(a, b, pad) {
    var p = pad || 0;
    var ox = Math.min(a.x + a.w + p, b.x + b.w + p) - Math.max(a.x - p, b.x - p);
    var oy = Math.min(a.y + a.h + p, b.y + b.h + p) - Math.max(a.y - p, b.y - p);
    if (ox <= 0 || oy <= 0) return null;
    return { ox: ox, oy: oy, axis: ox <= oy ? 'x' : 'y', area: ox * oy };
  }

  /** Does `a` sit entirely inside `b`? A label mask fully inside a node is a
   *  badge chip and is legal; one that straddles the border is clipped text. */
  function contains(b, a) {
    return a.x >= b.x && a.y >= b.y &&
           a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
  }

  /** Grow a box by `p` on every side. */
  function inflate(a, p) {
    return { x: a.x - p, y: a.y - p, w: a.w + 2 * p, h: a.h + 2 * p };
  }

  var API = {
    FACES: FACES,
    advanceOf: advanceOf,
    textWidth: textWidth,
    textHeight: textHeight,
    textBox: textBox,
    grid4: grid4,
    rect: rect,
    overlap: overlap,
    contains: contains,
    inflate: inflate,
    isWide: isWide
  };

  root.RZDiagramMetrics = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
