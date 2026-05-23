/* Network Visualization Hub — Palette (sole color source).
 *
 * Per plan §2 and §5.6 (v2.3): topic modules MUST consume colors via these
 * tokens. Hex literals in `js/network-anim/topics/*.js` are blocked by
 * tools/audit-network-anim.py.
 *
 * Tokens are the resistancezero.com brand industrial-instrumentation set
 * (see standarization/design.md §5 and KNOWLEDGE_LABS_STANDARD.md).
 *
 * Do NOT add new color tokens here without updating design.md, the audit
 * tool, and KNOWLEDGE_LABS_STANDARD.md in the same commit.
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var PALETTE = Object.freeze({
    'instrument-cyan':    '#00DDFF',   // primary informational / data
    'signal-amber':       '#FFAA00',   // advisory / transient pre-issuance (flow-stage tint exception only)
    'oscilloscope-green': '#00FF88',   // healthy operating state / ACK
    'fault-red':          '#FF3030',   // alarm / collision / drop
    'wire-default':       '#475569',   // wire stroke base (instrumentation grey-blue)
    'canvas-bg':          '#0F172A'    // canvas background (matches dark-mode body)
  });

  /**
   * Resolve a palette token to its hex value.
   * Throws if the token is unknown — fail fast at authoring time so the
   * audit + runtime path both catch typos.
   * @param {keyof typeof PALETTE} token
   * @returns {string}
   */
  function color(token) {
    if (!(token in PALETTE)) {
      throw new Error('[RZNetAnim.palette] unknown token: ' + token + ' (allowed: ' + Object.keys(PALETTE).join(', ') + ')');
    }
    return PALETTE[token];
  }

  /**
   * List all valid palette tokens (audit tool reads this).
   * @returns {string[]}
   */
  function tokens() {
    return Object.keys(PALETTE);
  }

  window.RZNetAnim.palette = Object.freeze({ color: color, tokens: tokens });
})();
