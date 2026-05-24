/* Network Visualization Hub — VFX (visual-effects lifecycle).
 *
 * Per plan §5.5 + §5.6 v2.3.
 *
 * BANNED in this file (lint-enforced by tools/audit-network-anim.py):
 *   - box-shadow / filter: blur / filter: drop-shadow (multi-layer) /
 *     mix-blend-mode: screen / mix-blend-mode: overlay
 *   - Hex color literals (must go through palette.js tokens via renderer)
 *
 * Caps enforced runtime:
 *   - Packet trail: ≤2 segments per active byte (alpha 0.35 → 0.12 → 0)
 *   - ACK ring: ≤1 active per node, 600 ms total (400 expand + 200 fade)
 *   - drawCalls reported per frame so engine can enforce ≤200/panel
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  // Trail history: per-active-byte FIFO of recent positions, length ≤2
  // Map: byteId → [{x, y}, ...]
  function createTrailStore() {
    var store = {};
    return {
      push: function (id, x, y) {
        var list = store[id] = store[id] || [];
        list.unshift({ x: x, y: y });
        if (list.length > 2) list.length = 2;
      },
      clear: function (id) { delete store[id]; },
      get: function (id) { return store[id] || []; },
      reset: function () { for (var k in store) delete store[k]; }
    };
  }

  /**
   * Draw the packet trail behind a byte chip.
   * Returns drawCall count.
   */
  function drawTrail(ctx, trail, shape, sizePx, paletteToken) {
    if (!trail || trail.length === 0) return 0;
    var alphas = [0.35, 0.12];
    var calls = 0;
    for (var i = 0; i < trail.length && i < 2; i++) {
      window.RZNetAnim.renderer.drawChip(
        ctx, trail[i].x, trail[i].y, shape, sizePx, paletteToken, alphas[i]
      );
      calls++;
    }
    return calls;
  }

  // ACK ring lifecycle
  // Map: nodeId → { startMs, durationMs }
  function createACKStore() {
    var store = {};
    return {
      trigger: function (id, nowMs) {
        store[id] = { startMs: nowMs, durationMs: 600 };
      },
      tick: function (id, nowMs) {
        var s = store[id];
        if (!s) return -1;
        var p = (nowMs - s.startMs) / s.durationMs;
        if (p >= 1) { delete store[id]; return -1; }
        return p;
      },
      activeIds: function () { return Object.keys(store); },
      reset: function () { for (var k in store) delete store[k]; }
    };
  }

  /**
   * Retransmission echo — amber dashed-arrow re-trace at 0.6 px, 50% opacity,
   * 200 ms, same path as the original byte (plan §5.5 v2.3).
   */
  function drawRetransmissionEcho(ctx, x1, y1, x2, y2, progress) {
    if (progress < 0 || progress > 1) return 0;
    ctx.save();
    var hex = window.RZNetAnim.palette.color('signal-amber');
    var a = Math.max(0, Math.min(255, Math.round(0.5 * 255))).toString(16);
    if (a.length < 2) a = '0' + a;
    ctx.strokeStyle = hex + a;
    ctx.lineWidth = 0.6;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    var snap = window.RZNetAnim.renderer._snapStroke;
    ctx.moveTo(snap(x1), snap(y1));
    var fx = x1 + (x2 - x1) * progress;
    var fy = y1 + (y2 - y1) * progress;
    ctx.lineTo(snap(fx), snap(fy));
    ctx.stroke();
    ctx.restore();
    return 1;
  }

  /**
   * Mode: 'full' (default) or 'minimal' (compare mode, plan §7).
   * Topic timbre's `compareDegrade` priority list governs which effects
   * are skipped in minimal mode.
   */
  function isAllowedInMinimal(effectName, compareDegrade) {
    if (!compareDegrade || compareDegrade.length === 0) return true;
    // Map effect → degrade key
    var key = ({
      'shroud': 'drop-shroud',
      'trail':  'drop-trail',
      'pulse':  'drop-pulse'
    })[effectName];
    if (!key) return true;
    return compareDegrade.indexOf(key) === -1;
  }

  window.RZNetAnim.vfx = Object.freeze({
    createTrailStore: createTrailStore,
    createACKStore: createACKStore,
    drawTrail: drawTrail,
    drawRetransmissionEcho: drawRetransmissionEcho,
    isAllowedInMinimal: isAllowedInMinimal
  });
})();
