/* ============================================================================
 * rz-svg-basis.js — traceability marks for numbers drawn INSIDE an SVG mimic
 * ----------------------------------------------------------------------------
 * Every HTML value cell on the cockpits carries data-basis-param and opens the
 * registry record on click. Nothing drawn inside a diagram did, and the owner
 * asked for a visible symbol on the parameter — on the drawing, not only on
 * the cards. This module is the one emitter for that:
 *
 *   RZSvgBasis.tag(spec)   -> '<g class="rz-basis" data-basis-param=… data-rz-text-group="basis"
 *                              tabindex="0" role="button"><text>value</text><circle …/><title/></g>'
 *   RZSvgBasis.mark(x,y,e) -> the mark alone, for hand-built <text> that cannot move to tag()
 *   RZSvgBasis.legend(x,y) -> the taxonomy legend, drawn ONCE per diagram
 *   RZSvgBasis.audit(root) -> { numerals, hooked, declared, unhooked:[…] } over `svg text`
 *
 * THREE MEASUREMENTS THAT SHAPED IT (2026-09-06)
 *   1. The mark is NOT text. The page's label tier is 4-6 user units and the legibility floor is
 *      8.5 rendered px, so a text chip beside a value is illegible by construction; and only
 *      <text> enters the geometry gate's collision loop. A 2.2-unit circle is seen by neither.
 *   2. Value + mark are ONE declared group (data-rz-text-group), so the pair cannot collide with
 *      itself while everything around it still gates — the chiller-plant ISA-balloon precedent.
 *   3. Hook and tabindex sit on the SAME node: the drawer's keydown path has no closest().
 *
 * The colour comes from the registry's evidenceClass through js/rz-evidence.js — never from a
 * page literal — so a wrong class is a wrong registry, which the registry gate catches.
 * ES5, zero-build, window.RZSvgBasis + module.exports.
 * ==========================================================================*/
(function (root) {
  'use strict';

  var MARK_R = 2.2;            // user units — sized for the 960-wide sheets
  var MARK_GAP = 2.4;          // gap between the text end and the mark centre (approx; text width unknown at build time)

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function evidenceApi() { return (root && root.RZEvidence) || (typeof require === 'function' ? require('./rz-evidence.js') : null); }

  function registry() {
    if (!root) { return null; }
    var name = root.RZSvgBasisRegistry || 'RZ_DCAI_PARAMETERS';
    var reg = root[name];
    if (!reg && root.RZ_CONV_PARAMETERS) { reg = root.RZ_CONV_PARAMETERS; }
    return reg && Array.isArray(reg.parameters) ? reg : null;
  }
  var INDEX = null, INDEX_FOR = null;
  function record(id) {
    var reg = registry();
    if (!reg) { return null; }
    if (INDEX_FOR !== reg) {
      INDEX = {}; INDEX_FOR = reg;
      for (var i = 0; i < reg.parameters.length; i++) { INDEX[reg.parameters[i].id] = reg.parameters[i]; }
    }
    return INDEX[id] || null;
  }
  function evidenceOf(id, fallback) {
    var p = record(id);
    var ev = p && p.evidenceClass ? p.evidenceClass : (fallback || 'UNAVAILABLE');
    return evidenceApi().normalize(ev);
  }

  /* Approximate rendered text width in user units for JetBrains Mono at size s:
     ~0.6 em per glyph. Used only to place the mark; the group exempts any slip. */
  function approxWidth(text, size) { return String(text).length * (size || 6) * 0.6; }

  /**
   * spec: { x, y, text, param, params:[…more ids for a composite string], size, fill, anchor, weight, family, id, evidence, title }
   * Returns one <g> string. `param` is the registry id (a LITERAL at the call site — the
   * registry generator credits literal ids, not variables).
   */
  function tag(spec) {
    var s = spec || {};
    var size = s.size || 6, anchor = s.anchor || 'start';
    var ev = s.evidence ? evidenceApi().normalize(s.evidence) : evidenceOf(s.param);
    var E = evidenceApi().get(ev);
    var rec = record(s.param);
    var label = (rec && rec.label) || s.param;
    var w = approxWidth(s.text, size);
    var mx = anchor === 'end' ? s.x + MARK_GAP + MARK_R : anchor === 'middle' ? s.x + w / 2 + MARK_GAP + MARK_R : s.x + w + MARK_GAP + MARK_R;
    var my = s.y - size * 0.32;
    var textAttrs = 'x="' + s.x + '" y="' + s.y + '" fill="' + (s.fill || 'var(--t2)') + '" font-family="' + (s.family || 'JetBrains Mono') + '" font-size="' + size + '"'
      + (anchor !== 'start' ? ' text-anchor="' + anchor + '"' : '') + (s.weight ? ' font-weight="600"' : '') + (s.id ? ' id="' + esc(s.id) + '"' : '');
    var title = s.title || (label + ' · ' + ev + ' · ' + s.param);
    var also = Array.isArray(s.params) && s.params.length ? ' data-basis-params="' + esc([s.param].concat(s.params).join(' ')) + '"' : '';
    return '<g class="rz-basis" data-basis-param="' + esc(s.param) + '"' + also + (s.nomark ? ' data-rz-nomark="1"' : '') + ' data-rz-text-group="basis" data-evidence="' + ev + '" tabindex="0" role="button">'
      + '<title>' + esc(title) + '</title>'
      + '<text ' + textAttrs + '>' + s.text + '</text>'
      /* nomark: a repeated row (a ladder of 40 identical group lines) stays hooked and clickable but
         draws no symbol — one mark per parameter per diagram, not one per mention */
      + (s.nomark ? '' : '<circle class="rz-basis-mark" cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="' + MARK_R + '" fill="' + E.color + '" stroke="var(--bg2,#0b1220)" stroke-width="0.5"/>')
      + '</g>';
  }

  /** The mark alone (for a <text> the caller already emitted; wrap both in a group yourself). */
  function mark(x, y, evidence) {
    var E = evidenceApi().get(evidence);
    return '<circle class="rz-basis-mark" cx="' + x + '" cy="' + y + '" r="' + MARK_R + '" fill="' + E.color + '" stroke="var(--bg2,#0b1220)" stroke-width="0.5"><title>' + esc(E.id) + ' — ' + esc(E.note) + '</title></circle>';
  }

  /** Legend row: five dots + words, one per diagram. Only the classes present are shown if `only` given. */
  function legend(x, y, opts) {
    var o = opts || {}; var size = o.size || 4.2; var gap = o.gap || 46;
    var ids = o.only || ['DERIVED', 'ADOPTED', 'ASSUMED', 'PUBLISHED', 'SIMULATED'];
    var out = '<g class="rz-basis-legend" data-rz-text-group="basis-legend" aria-hidden="true">';
    out += '<text x="' + x + '" y="' + y + '" fill="var(--t3)" font-family="JetBrains Mono" font-size="' + size + '">BASIS</text>';
    var cx = x + size * 4.2;
    for (var i = 0; i < ids.length; i++) {
      var E = evidenceApi().get(ids[i]);
      out += '<circle cx="' + cx + '" cy="' + (y - size * 0.32) + '" r="' + MARK_R + '" fill="' + E.color + '"/>';
      out += '<text x="' + (cx + MARK_R + 1.6) + '" y="' + y + '" fill="var(--t3)" font-family="JetBrains Mono" font-size="' + size + '">' + E.id + '</text>';
      cx += gap;
    }
    return out + '</g>';
  }

  /** Coverage measurement over rendered SVG text — the same shape RZLineModel.audit() has. */
  function audit(rootEl) {
    var doc = rootEl || (root && root.document);
    if (!doc || !doc.querySelectorAll) { return null; }
    var texts = doc.querySelectorAll('svg text');
    var numeral = /-?\d[\d,]*(?:\.\d+)?/;
    var out = { numerals: 0, hooked: 0, declared: 0, unhooked: [] };
    for (var i = 0; i < texts.length; i++) {
      var t = texts[i], s = (t.textContent || '').trim();
      if (!numeral.test(s)) { continue; }
      var box = t.getBoundingClientRect ? t.getBoundingClientRect() : { width: 1, height: 1 };
      if (!box.width || !box.height) { continue; }
      out.numerals++;
      var hook = t.closest ? t.closest('[data-basis-param]') : null;
      if (hook && record(hook.getAttribute('data-basis-param'))) { out.hooked++; continue; }
      var decl = t.closest ? t.closest('[data-rz-authored-basis],[data-rz-distribution]') : null;
      if (decl) { out.declared++; continue; }
      if (out.unhooked.length < 400) {
        var svg = t.closest('svg');
        out.unhooked.push({ svg: svg ? svg.id : '', text: s.slice(0, 60) });
      }
    }
    return out;
  }

  var API = { tag: tag, mark: mark, legend: legend, audit: audit, evidenceOf: evidenceOf, record: record, MARK_R: MARK_R, version: '1.0.0' };
  if (root) { root.RZSvgBasis = API; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
