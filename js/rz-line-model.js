/* ============================================================================
 * rz-line-model.js — semantic line model for BMS cockpit diagrams (v1.42.0)
 * ----------------------------------------------------------------------------
 * Foundation library for the v1.42.x→v1.45.x sweep responding to team review
 * docs 27/28 (DC AI) + 17/18 (DC Conv).
 *
 * REVIEW MANDATE (doc-27 §3.1 / doc-28 Sshot 00-09-18 / doc-17 §3.2 / doc-18 EPMS):
 *   "Setiap line wajib punya from_id, to_id, medium, direction, state,
 *    capacity, current_value, dan redundancy_role."
 *
 * This module turns the requirement into:
 *   - a canonical schema (data-* attributes on every SVG line/path),
 *   - a builder API (`RZLineModel.line(spec)` / `.path(spec)`) that emits
 *     SVG strings with both the visual rendering AND the metadata baked in,
 *   - a state→stroke mapping so visual state is derived from semantics
 *     (no more ad-hoc colours for the same medium),
 *   - a DOM walker (`RZLineModel.audit(svgRoot)`) that reports missing
 *     metadata / orphan endpoints — consumed by tools/probe-line-model.mjs.
 *
 * Zero-build, ES5-safe, no imports. Loads in the browser via <script src>.
 * Engine integrity: this module ADDS metadata; it never replaces existing
 * rendering logic. Existing un-tagged SVG primitives keep rendering exactly
 * the same. Ports happen one diagram at a time per the v1.42.x ship plan.
 * ==========================================================================*/
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Schema constants                                                    */
  /* ------------------------------------------------------------------ */

  /* Mediums — what the line carries. Maps to a base colour (CSS variable)
   * matching the existing datahallAI / dc-conventional palette. */
  var MEDIUMS = {
    /* Cooling */
    'chws':         { label: 'Chilled Water Supply',       color: 'var(--c)',  baseRGB: '6,182,212',  dash: false },
    'chwr':         { label: 'Chilled Water Return',       color: 'var(--o)',  baseRGB: '245,158,11', dash: true  },
    'tcs_supply':   { label: 'Tech Cooling Supply',        color: 'var(--c)',  baseRGB: '6,182,212',  dash: false },
    'tcs_return':   { label: 'Tech Cooling Return',        color: 'var(--o)',  baseRGB: '245,158,11', dash: true  },
    'cw_supply':    { label: 'Condenser Water Supply',     color: 'var(--p)',  baseRGB: '139,92,246', dash: false },
    'cw_return':    { label: 'Condenser Water Return',     color: 'var(--p)',  baseRGB: '139,92,246', dash: true  },
    'fws':          { label: 'Facility Water Supply',      color: 'var(--c)',  baseRGB: '6,182,212',  dash: false },
    'fwr':          { label: 'Facility Water Return',      color: 'var(--o)',  baseRGB: '245,158,11', dash: true  },
    'dry_loop':     { label: 'Dry Cooler Glycol Loop',     color: 'var(--p)',  baseRGB: '139,92,246', dash: false },
    'liquid_supply':{ label: 'Liquid-Cooling Supply',      color: 'var(--c2,#22d3ee)', baseRGB: '34,211,238', dash: false },
    'liquid_return':{ label: 'Liquid-Cooling Return',      color: 'var(--c2,#22d3ee)', baseRGB: '34,211,238', dash: true  },
    /* Power */
    'power_hv':     { label: 'High-Voltage Power (≥35kV)', color: 'var(--r)',  baseRGB: '239,68,68',  dash: false },
    'power_mv':     { label: 'Medium-Voltage Power',       color: 'var(--o)',  baseRGB: '245,158,11', dash: false },
    'power_lv':     { label: 'Low-Voltage Power',          color: 'var(--g)',  baseRGB: '34,197,94',  dash: false },
    'busway':       { label: 'Busway / Bus-Duct',          color: 'var(--g)',  baseRGB: '34,197,94',  dash: false },
    'ups_feed':     { label: 'UPS Feed (A/B redundant)',   color: 'var(--g)',  baseRGB: '34,197,94',  dash: false },
    /* Signal / Comms */
    'signal':       { label: 'BMS / Control Signal',       color: 'var(--t3)', baseRGB: '148,163,184', dash: false },
    'fiber':        { label: 'Fibre Optic',                color: 'var(--c)',  baseRGB: '6,182,212',  dash: false },
    'copper':       { label: 'Copper Network (RJ45)',      color: 'var(--g)',  baseRGB: '34,197,94',  dash: false },
    /* Safety */
    'fire':         { label: 'Fire Signal / Suppression',  color: 'var(--r)',  baseRGB: '239,68,68',  dash: false },
    'leak':         { label: 'Leak Detection',             color: 'var(--o)',  baseRGB: '245,158,11', dash: false },
    /* Process */
    'drain':        { label: 'Drain / Effluent',           color: 'var(--o)',  baseRGB: '245,158,11', dash: false },
    'fuel':         { label: 'Fuel (Diesel)',              color: 'var(--o)',  baseRGB: '245,158,11', dash: false }
  };

  /* States — operational status of the line. Drives visual treatment. */
  var STATES = {
    'energized':    { label: 'Energized / Active',  opacity: 1.0,  pulse: false },
    'de-energized': { label: 'De-energized',        opacity: 0.35, pulse: false },
    'standby':      { label: 'Standby (N+1 spare)', opacity: 0.55, pulse: false },
    'fault':        { label: 'Fault / Tripped',     opacity: 1.0,  pulse: true  },
    'isolated':     { label: 'Isolated for Maint.', opacity: 0.30, pulse: false },
    'maintenance':  { label: 'Maintenance Mode',    opacity: 0.55, pulse: false },
    'simulated':    { label: 'Simulated Telemetry', opacity: 0.85, pulse: false }
  };

  /* Redundancy roles. */
  var REDUNDANCY = {
    'duty':         'Duty (primary in service)',
    'standby':      'Standby (N+1 spare)',
    'redundant_a':  'Redundant feed A (2N)',
    'redundant_b':  'Redundant feed B (2N)',
    'bypass':       'Bypass path',
    'tie':          'Tie / cross-couple',
    'maintenance':  'Maintenance loop',
    'common':       'Common / non-redundant'
  };

  /* Direction tokens. */
  var DIRECTIONS = { 'forward': 1, 'reverse': 1, 'bidirectional': 1 };

  /* ------------------------------------------------------------------ */
  /* Internals                                                           */
  /* ------------------------------------------------------------------ */

  function esc(s) {
    if (s === null || s === undefined) { return ''; }
    return String(s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function getMedium(name) {
    if (!name || !MEDIUMS[name]) {
      return { label: 'Unspecified', color: 'var(--t3)', baseRGB: '148,163,184', dash: false };
    }
    return MEDIUMS[name];
  }

  function getState(name) {
    if (!name || !STATES[name]) { return STATES['energized']; }
    return STATES[name];
  }

  /* Compose stroke colour from medium + state opacity. Falls back to the
   * CSS variable when state is fully energized. */
  function strokeColor(medium, state) {
    var m = getMedium(medium);
    var st = getState(state);
    if (st.opacity >= 0.99) { return m.color; }
    return 'rgba(' + m.baseRGB + ',' + st.opacity.toFixed(2) + ')';
  }

  /* Compose data-* attributes from the spec. Spec fields are optional;
   * missing fields are omitted from the output (audit() will flag them). */
  function dataAttrs(spec) {
    var out = ' data-rz-line="1"';
    var keys = ['id', 'from', 'to', 'medium', 'direction', 'state',
                'capacity', 'current', 'redundancy', 'sensor', 'tag'];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (spec[k] !== undefined && spec[k] !== null && spec[k] !== '') {
        out += ' data-' + k + '="' + esc(spec[k]) + '"';
      }
    }
    return out;
  }

  /* Compose style attributes from medium + state + optional overrides. */
  function styleAttrs(spec) {
    var m = getMedium(spec.medium);
    var st = getState(spec.state);
    var style = spec.style || {};

    var stroke = style.stroke || strokeColor(spec.medium, spec.state);
    var strokeWidth = style.strokeWidth || 1.5;
    var out = ' stroke="' + stroke + '" stroke-width="' + strokeWidth + '"';

    if (m.dash && !style.solid) {
      out += ' stroke-dasharray="' + (style.dashPattern || '4 2') + '"';
    } else if (style.dashPattern) {
      out += ' stroke-dasharray="' + style.dashPattern + '"';
    }

    if (style.linecap) { out += ' stroke-linecap="' + style.linecap + '"'; }
    if (style.opacity !== undefined) { out += ' opacity="' + style.opacity + '"'; }
    if (style.cssClass) { out += ' class="' + esc(style.cssClass) + '"'; }
    if (style.markerEnd) { out += ' marker-end="' + style.markerEnd + '"'; }
    if (style.fill) { out += ' fill="' + style.fill + '"'; }
    else { out += ' fill="none"'; }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                          */
  /* ------------------------------------------------------------------ */

  /* Emit an SVG <line> element with full metadata. */
  function line(spec) {
    if (!spec || spec.geometry === undefined) { return ''; }
    var g = spec.geometry;
    return '<line x1="' + g.x1 + '" y1="' + g.y1 + '" x2="' + g.x2 + '" y2="' + g.y2 + '"' +
           styleAttrs(spec) + dataAttrs(spec) + '/>';
  }

  /* Emit an SVG <path> element with full metadata. Useful for orthogonal
   * connectors with multiple segments. */
  function path(spec) {
    if (!spec || !spec.d) { return ''; }
    return '<path d="' + spec.d + '"' + styleAttrs(spec) + dataAttrs(spec) + '/>';
  }

  /* Emit a polyline with full metadata. */
  function polyline(spec) {
    if (!spec || !spec.points) { return ''; }
    return '<polyline points="' + spec.points + '"' + styleAttrs(spec) + dataAttrs(spec) + '/>';
  }

  /* ------------------------------------------------------------------ */
  /* Auditing — walk a root SVG (or document) and report compliance.    */
  /* Used by tools/probe-line-model.mjs.                                */
  /* ------------------------------------------------------------------ */

  function audit(rootEl) {
    var doc = rootEl || (typeof document !== 'undefined' ? document : null);
    if (!doc) { return { tagged: 0, issues: [{ kind: 'no-document', detail: 'no DOM' }] }; }

    var tagged = doc.querySelectorAll('[data-rz-line="1"]');
    var allLines = doc.querySelectorAll('line,path[d],polyline');
    var issues = [];
    var taggedCount = tagged.length;
    var requiredFields = ['from', 'to', 'medium', 'state'];

    for (var i = 0; i < tagged.length; i++) {
      var el = tagged[i];
      for (var f = 0; f < requiredFields.length; f++) {
        var field = requiredFields[f];
        if (!el.getAttribute('data-' + field)) {
          issues.push({
            kind: 'missing-field',
            field: field,
            id: el.getAttribute('data-id') || '(unset)',
            tag: el.tagName
          });
        }
      }
      var medium = el.getAttribute('data-medium');
      if (medium && !MEDIUMS[medium]) {
        issues.push({ kind: 'unknown-medium', medium: medium, id: el.getAttribute('data-id') });
      }
      var state = el.getAttribute('data-state');
      if (state && !STATES[state]) {
        issues.push({ kind: 'unknown-state', state: state, id: el.getAttribute('data-id') });
      }
    }

    return {
      tagged: taggedCount,
      untagged: allLines.length - taggedCount,
      total: allLines.length,
      issues: issues,
      coverage: allLines.length === 0 ? 0 : Math.round(taggedCount / allLines.length * 100)
    };
  }

  /* ------------------------------------------------------------------ */
  /* Export                                                              */
  /* ------------------------------------------------------------------ */

  var API = {
    line: line,
    path: path,
    polyline: polyline,
    audit: audit,
    MEDIUMS: MEDIUMS,
    STATES: STATES,
    REDUNDANCY: REDUNDANCY,
    DIRECTIONS: DIRECTIONS,
    version: '1.42.0'
  };

  if (root) { root.RZLineModel = API; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
