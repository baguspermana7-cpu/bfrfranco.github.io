/* ============================================================================
 * rz-evidence.js — THE evidence taxonomy, published once for every surface.
 * ----------------------------------------------------------------------------
 * The parameter registries (data/conv-parameters.json, data/dcai-parameters.json)
 * classify every published number with one of ten evidence classes. Until
 * v2.1.0 the colour and the one-line meaning of each class lived as two private
 * tables inside js/rz-basis-drawer.js — and those tables were missing LABEL and
 * PUBLISHED, so 28 of the AI page's 200 parameters rendered a grey fallback and
 * an empty Evidence row. A vocabulary that exists in one renderer's closure is
 * not a vocabulary. This file is the single source: the basis drawer, the
 * right-side inspector and the SVG traceability mark all read it.
 *
 * ACCURACY_VALIDATION.md Rule 6 (v2.1.0) is written against THIS list.
 * ES5, zero-build, window.RZEvidence + module.exports.
 * ==========================================================================*/
(function (root) {
  'use strict';

  /* Order is the legend order: from "printed by someone else" to "we chose it". */
  var CLASSES = [
    { id: 'PUBLISHED',   short: 'P', color: '#4b8fd0', note: 'Printed by the vendor or standards body named in the source; not measured here.' },
    { id: 'STANDARD',    short: 'S', color: '#4b8fd0', note: 'A physical constant or a code value.' },
    { id: 'VENDOR',      short: 'V', color: '#4b8fd0', note: 'Vendor-quoted for this project; screening grade until confirmed.' },
    { id: 'DERIVED',     short: 'D', color: '#3f9d6b', note: 'Computed by the engine from other parameters; nothing typed.' },
    { id: 'ADOPTED',     short: 'A', color: '#d99a2b', note: 'A project or owner design decision, stated as such.' },
    { id: 'ASSUMED',     short: 'U', color: '#d99a2b', note: 'A textbook or mid-band value chosen before the result was looked at; pending Basis-of-Design.' },
    { id: 'SIMULATED',   short: 'M', color: '#8b7bd0', note: 'A modelled operating value or a simulated sensor; never a field reading.' },
    { id: 'MEASURED',    short: 'R', color: '#3f9d6b', note: 'A real instrument reading. Nothing on these pages is MEASURED today.' },
    { id: 'LABEL',       short: 'L', color: '#8fa2b8', note: 'A name, a version or a nameplate figure used as a label — never a denominator.' },
    { id: 'UNAVAILABLE', short: '—', color: '#e4564a', note: 'Not published by the source and not derivable here; shown as an em dash, never estimated.' }
  ];

  var BY_ID = {};
  for (var i = 0; i < CLASSES.length; i++) { BY_ID[CLASSES[i].id] = CLASSES[i]; }

  function normalize(cls) {
    if (!cls) { return 'UNAVAILABLE'; }
    /* compound scenario classes such as "SIMULATED/ADOPTED" take their FIRST term */
    var first = String(cls).split('/')[0].trim().toUpperCase();
    return BY_ID[first] ? first : 'UNAVAILABLE';
  }

  var API = {
    CLASSES: CLASSES,
    ids: CLASSES.map(function (c) { return c.id; }),
    get: function (cls) { return BY_ID[normalize(cls)]; },
    color: function (cls) { return BY_ID[normalize(cls)].color; },
    note: function (cls) { return BY_ID[normalize(cls)].note; },
    short: function (cls) { return BY_ID[normalize(cls)].short; },
    normalize: normalize,
    version: '1.0.0'
  };
  if (Object.freeze) { Object.freeze(API); }

  if (root) { root.RZEvidence = API; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
