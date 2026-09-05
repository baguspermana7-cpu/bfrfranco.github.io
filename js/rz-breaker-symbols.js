/* ============================================================================
 * rz-breaker-symbols.js — IEC/ANSI breaker symbol library (v1.42.1)
 * ----------------------------------------------------------------------------
 * Companion to rz-line-model.js. Responds to review docs 27/28 §3.1/§5.3
 * (DC AI) + docs 17/18 §3.2 (DC Conv):
 *
 *   "Gunakan simbol breaker open/closed/tripped, bukan hanya warna."
 *   "Red/green line dapat ditafsirkan sebagai energized/alarm/source.
 *    Breaker state belum cukup jelas jika hanya warna."
 *
 * The library turns the requirement into:
 *   - 7 STATES: closed / open / tripped / racked_out / test / maintenance / disabled
 *   - State-driven SVG symbol (IEC 60617 / IEEE C37.2 compliant geometry)
 *   - data-* metadata so the probe + inspector can introspect
 *   - Device-function badge (ANSI 50/51/87T/27/25 etc) as optional overlay
 *
 * Zero-build, ES5-safe, no imports. Additive — existing symCB / symCBe
 * helpers in datahallAI continue to work. Pilot ports happen one section
 * at a time per the v1.42.x ship plan.
 * ==========================================================================*/
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* States — IEC 60617 + IEEE C37.2 visual treatment per state.        */
  /* ------------------------------------------------------------------ */
  var STATES = {
    'closed':       { label: 'Closed (in service)',     glyph: 'closed',    color: 'var(--g)', opacity: 1.0,  pulse: false },
    'open':         { label: 'Open (de-energized)',     glyph: 'open',      color: 'var(--t3)', opacity: 0.8,  pulse: false },
    'tripped':      { label: 'Tripped (fault)',         glyph: 'tripped',   color: 'var(--r)', opacity: 1.0,  pulse: true  },
    'racked_out':   { label: 'Racked-out (drawn out)',  glyph: 'racked',    color: 'var(--o)', opacity: 0.85, pulse: false },
    'test':         { label: 'Test position',           glyph: 'test',      color: 'var(--c)', opacity: 0.9,  pulse: false },
    'maintenance':  { label: 'Maintenance (LOTO)',      glyph: 'lockout',   color: 'var(--p)', opacity: 0.85, pulse: false },
    'disabled':     { label: 'Administratively disabled', glyph: 'disabled', color: 'var(--t3)', opacity: 0.5,  pulse: false }
  };

  /* Device function numbers per IEEE C37.2 — common DC switchgear set. */
  var DEVICE_FUNCTIONS = {
    '25':  'Synchronism-check',
    '27':  'Undervoltage',
    '50':  'Instantaneous overcurrent',
    '51':  'Time overcurrent',
    '52':  'AC circuit breaker',
    '67':  'Directional overcurrent',
    '67N': 'Directional earth-fault',
    '81':  'Frequency',
    '86':  'Lockout',
    '87T': 'Differential protection (transformer)',
    '87B': 'Differential protection (bus)'
  };

  /* Arc-flash PPE categories per NFPA 70E 2024. */
  var AF_CATEGORIES = {
    'PPE1': '≤4 cal/cm²',
    'PPE2': '4–8 cal/cm²',
    'PPE3': '8–25 cal/cm²',
    'PPE4': '25–40 cal/cm²'
  };

  function esc(s) {
    if (s === null || s === undefined) { return ''; }
    return String(s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function getState(name) {
    if (!name || !STATES[name]) { return STATES['closed']; }
    return STATES[name];
  }

  /* ------------------------------------------------------------------ */
  /* Glyph renderers — each state has its own visual treatment.         */
  /* ------------------------------------------------------------------ */

  function glyphClosed(cx, cy, c) {
    /* Closed: vertical mechanical link between two terminal dots — IEC 60617 closed CB. */
    return '<circle cx="' + cx + '" cy="' + (cy - 6) + '" r="2" fill="' + c + '" opacity=".7"/>' +
           '<circle cx="' + cx + '" cy="' + (cy + 6) + '" r="2" fill="' + c + '" opacity=".7"/>' +
           '<line x1="' + cx + '" y1="' + (cy - 5) + '" x2="' + cx + '" y2="' + (cy + 5) + '" stroke="' + c + '" stroke-width="1.6"/>';
  }

  function glyphOpen(cx, cy, c) {
    /* Open: angled arm rotated ~30° from vertical, separated from upper terminal. */
    return '<circle cx="' + cx + '" cy="' + (cy - 6) + '" r="2" fill="none" stroke="' + c + '" stroke-width=".8" opacity=".8"/>' +
           '<circle cx="' + cx + '" cy="' + (cy + 6) + '" r="2" fill="' + c + '" opacity=".7"/>' +
           '<line x1="' + cx + '" y1="' + (cy + 5) + '" x2="' + (cx + 5) + '" y2="' + (cy - 4) + '" stroke="' + c + '" stroke-width="1.6"/>';
  }

  function glyphTripped(cx, cy, c) {
    /* Tripped: open arm + red X overlay + pulsing alarm. */
    var pulse = '<animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite"/>';
    return '<circle cx="' + cx + '" cy="' + (cy - 6) + '" r="2" fill="none" stroke="' + c + '" stroke-width=".8"/>' +
           '<circle cx="' + cx + '" cy="' + (cy + 6) + '" r="2" fill="' + c + '"/>' +
           '<line x1="' + cx + '" y1="' + (cy + 5) + '" x2="' + (cx + 5) + '" y2="' + (cy - 4) + '" stroke="' + c + '" stroke-width="1.6">' + pulse + '</line>' +
           '<line x1="' + (cx - 4) + '" y1="' + (cy - 3) + '" x2="' + (cx + 4) + '" y2="' + (cy + 3) + '" stroke="' + c + '" stroke-width="1.2"/>' +
           '<line x1="' + (cx - 4) + '" y1="' + (cy + 3) + '" x2="' + (cx + 4) + '" y2="' + (cy - 3) + '" stroke="' + c + '" stroke-width="1.2"/>';
  }

  function glyphRacked(cx, cy, c) {
    /* Racked-out: open arm + dashed bracket indicating drawn-out cradle. */
    return '<rect x="' + (cx - 6) + '" y="' + (cy - 9) + '" width="12" height="18" rx="1" fill="none" stroke="' + c + '" stroke-width=".6" stroke-dasharray="2 1.5" opacity=".7"/>' +
           '<circle cx="' + cx + '" cy="' + (cy - 6) + '" r="2" fill="none" stroke="' + c + '" stroke-width=".8"/>' +
           '<circle cx="' + cx + '" cy="' + (cy + 6) + '" r="2" fill="none" stroke="' + c + '" stroke-width=".8"/>' +
           '<line x1="' + cx + '" y1="' + (cy + 5) + '" x2="' + (cx + 5) + '" y2="' + (cy - 4) + '" stroke="' + c + '" stroke-width="1.4"/>';
  }

  function glyphTest(cx, cy, c) {
    /* Test position: open arm + 'T' label badge. */
    return '<circle cx="' + cx + '" cy="' + (cy - 6) + '" r="2" fill="none" stroke="' + c + '" stroke-width=".8"/>' +
           '<circle cx="' + cx + '" cy="' + (cy + 6) + '" r="2" fill="' + c + '" opacity=".5"/>' +
           '<line x1="' + cx + '" y1="' + (cy + 5) + '" x2="' + (cx + 5) + '" y2="' + (cy - 4) + '" stroke="' + c + '" stroke-width="1.4"/>' +
           '<rect x="' + (cx - 9) + '" y="' + (cy - 3) + '" width="6" height="6" rx="1" fill="rgba(6,182,212,.18)" stroke="' + c + '" stroke-width=".4"/>' +
           '<text x="' + (cx - 6) + '" y="' + (cy + 2) + '" fill="' + c + '" font-family="JetBrains Mono,monospace" font-size="4" text-anchor="middle" font-weight="700">T</text>';
  }

  function glyphLockout(cx, cy, c) {
    /* Maintenance (LOTO): closed arm + padlock badge overlay. */
    return '<circle cx="' + cx + '" cy="' + (cy - 6) + '" r="2" fill="' + c + '" opacity=".5"/>' +
           '<circle cx="' + cx + '" cy="' + (cy + 6) + '" r="2" fill="' + c + '" opacity=".5"/>' +
           '<line x1="' + cx + '" y1="' + (cy + 5) + '" x2="' + (cx + 5) + '" y2="' + (cy - 4) + '" stroke="' + c + '" stroke-width="1.4"/>' +
           '<rect x="' + (cx - 11) + '" y="' + (cy - 2) + '" width="7" height="5" rx=".8" fill="rgba(195,176,250,.22)" stroke="' + c + '" stroke-width=".4"/>' +
           '<path d="M' + (cx - 9) + ' ' + (cy - 2) + ' L' + (cx - 9) + ' ' + (cy - 4) + ' a1.5 1.5 0 0 1 3 0 L' + (cx - 6) + ' ' + (cy - 2) + '" fill="none" stroke="' + c + '" stroke-width=".5"/>';
  }

  function glyphDisabled(cx, cy, c) {
    /* Disabled: very faint open arm + diagonal slash. */
    return '<circle cx="' + cx + '" cy="' + (cy - 6) + '" r="2" fill="none" stroke="' + c + '" stroke-width=".5" opacity=".5"/>' +
           '<circle cx="' + cx + '" cy="' + (cy + 6) + '" r="2" fill="none" stroke="' + c + '" stroke-width=".5" opacity=".5"/>' +
           '<line x1="' + cx + '" y1="' + (cy + 5) + '" x2="' + (cx + 5) + '" y2="' + (cy - 4) + '" stroke="' + c + '" stroke-width="1" opacity=".5"/>' +
           '<line x1="' + (cx - 6) + '" y1="' + (cy + 9) + '" x2="' + (cx + 6) + '" y2="' + (cy - 9) + '" stroke="' + c + '" stroke-width=".4" opacity=".5"/>';
  }

  var GLYPHS = {
    'closed':   glyphClosed,
    'open':     glyphOpen,
    'tripped':  glyphTripped,
    'racked':   glyphRacked,
    'test':     glyphTest,
    'lockout':  glyphLockout,
    'disabled': glyphDisabled
  };

  /* ------------------------------------------------------------------ */
  /* Public API                                                          */
  /* ------------------------------------------------------------------ */

  /* Build a complete breaker SVG group with metadata.
   * Spec:
   *   { id, state, x, y, color, voltage, rating_a, rating_ka,
   *     deviceFunctions: ['50','51','67N'], afCategory: 'PPE2',
   *     ctRatio: '600/5', interlock: 'permissive_ok',
   *     redundancy: 'redundant_a', upstream: 'BUS-A', downstream: 'DH-01' }
   */
  function render(spec) {
    if (!spec || spec.x === undefined || spec.y === undefined) { return ''; }

    var st = getState(spec.state || 'closed');
    var color = spec.color || st.color;
    var cx = spec.x;
    var cy = spec.y;
    var glyphFn = GLYPHS[st.glyph] || glyphClosed;

    var data = ' data-rz-breaker="1"';
    if (spec.id) { data += ' data-id="' + esc(spec.id) + '"'; }
    data += ' data-state="' + esc(spec.state || 'closed') + '"';
    if (spec.upstream) { data += ' data-upstream="' + esc(spec.upstream) + '"'; }
    if (spec.downstream) { data += ' data-downstream="' + esc(spec.downstream) + '"'; }
    if (spec.voltage) { data += ' data-voltage="' + esc(spec.voltage) + '"'; }
    if (spec.rating_a) { data += ' data-rating-a="' + esc(spec.rating_a) + '"'; }
    if (spec.rating_ka) { data += ' data-rating-ka="' + esc(spec.rating_ka) + '"'; }
    if (spec.deviceFunctions && spec.deviceFunctions.length) {
      data += ' data-device-fns="' + esc(spec.deviceFunctions.join(',')) + '"';
    }
    if (spec.afCategory) { data += ' data-af="' + esc(spec.afCategory) + '"'; }
    if (spec.ctRatio) { data += ' data-ct="' + esc(spec.ctRatio) + '"'; }
    if (spec.interlock) { data += ' data-interlock="' + esc(spec.interlock) + '"'; }
    if (spec.redundancy) { data += ' data-redundancy="' + esc(spec.redundancy) + '"'; }

    var tip = '';
    if (spec.id) {
      var lines = [esc(spec.id) + ' — ' + st.label];
      if (spec.rating_a) { lines.push(spec.rating_a + ' / ' + (spec.rating_ka || '?') + ' kA'); }
      if (spec.deviceFunctions && spec.deviceFunctions.length) {
        lines.push('ANSI ' + spec.deviceFunctions.join('/'));
      }
      if (spec.ctRatio) { lines.push('CT ' + spec.ctRatio); }
      if (spec.afCategory) { lines.push('AF ' + esc(spec.afCategory) + ' ' + (AF_CATEGORIES[spec.afCategory] || '')); }
      tip = ' data-tip="' + lines.join(' | ') + '"';
    }

    var inner = glyphFn(cx, cy, color);

    return '<g' + data + tip + ' style="cursor:pointer">' + inner + '</g>';
  }

  /* Audit all tagged breakers in the document. */
  function audit(rootEl) {
    var doc = rootEl || (typeof document !== 'undefined' ? document : null);
    if (!doc) { return { tagged: 0, issues: [{ kind: 'no-document' }] }; }
    var nodes = doc.querySelectorAll('[data-rz-breaker="1"]');
    var issues = [];
    var required = ['id', 'state'];
    for (var i = 0; i < nodes.length; i++) {
      for (var f = 0; f < required.length; f++) {
        if (!nodes[i].getAttribute('data-' + required[f])) {
          issues.push({ kind: 'missing-field', field: required[f], idx: i });
        }
      }
      var state = nodes[i].getAttribute('data-state');
      if (state && !STATES[state]) {
        issues.push({ kind: 'unknown-state', state: state, idx: i });
      }
    }
    return { tagged: nodes.length, issues: issues };
  }

  /* ------------------------------------------------------------------ */
  /* Export                                                              */
  /* ------------------------------------------------------------------ */

  var API = {
    render: render,
    audit: audit,
    STATES: STATES,
    DEVICE_FUNCTIONS: DEVICE_FUNCTIONS,
    AF_CATEGORIES: AF_CATEGORIES,
    version: '1.42.1'
  };

  if (root) { root.RZBreakerSymbols = API; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
