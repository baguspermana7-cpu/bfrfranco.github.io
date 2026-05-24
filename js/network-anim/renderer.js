/* Network Visualization Hub — Renderer (Canvas 2D primitives).
 *
 * Per plan §5.1 + §5.3 + §5.5 v2.3. Pixel-snap mandate is enforced HERE:
 *   - Stroke endpoints:  Math.round(x) + 0.5
 *   - Chip origins:      Math.round(originX), Math.round(originY)
 *
 * Public surface (all functions accept ctx as first arg):
 *   drawWire(ctx, x1, y1, x2, y2, style, widthPx)
 *   drawChip(ctx, x, y, shape, sizePx, paletteToken, alpha)
 *   drawNode(ctx, x, y, icon, label)
 *   drawACKRing(ctx, x, y, progress, alpha)
 *   drawCollisionX(ctx, x, y, alpha)
 *   drawDropArrow(ctx, x, y, alpha)
 *   drawScanlineShroud(ctx, x1, y1, x2, y2)
 *   clear(ctx)
 *   measureChip(shape, sizePx) → {w, h}
 *
 * Every function returns the number of drawCalls it issued so the engine
 * can enforce ≤200 per frame per panel (plan §7).
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  /** Half-pixel snap for stroke coordinates */
  function snapStroke(v) { return Math.round(v) + 0.5; }
  /** Integer snap for chip origins */
  function snapOrigin(v) { return Math.round(v); }

  /**
   * Resolve a palette token + alpha into a CSS color string.
   * Alpha is appended as 8-bit hex.
   */
  function _color(token, alpha) {
    var hex = window.RZNetAnim.palette.color(token);  // throws if unknown
    if (typeof alpha !== 'number' || alpha >= 1) return hex;
    var a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
    var as = a.toString(16);
    if (as.length < 2) as = '0' + as;
    return hex + as;
  }

  function clear(ctx) {
    ctx.fillStyle = window.RZNetAnim.palette.color('canvas-bg');
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    return 1;
  }

  function drawWire(ctx, x1, y1, x2, y2, style, widthPx) {
    style = style || 'serial-thin';
    var w = (typeof widthPx === 'number') ? widthPx : 0.7;

    ctx.save();
    ctx.lineWidth = w;
    ctx.strokeStyle = _color('wire-default');
    ctx.lineCap = 'round';

    if (style === 'sideband-dashed') {
      ctx.setLineDash([4, 3]);
    } else if (style === 'http2-multiplex') {
      // 4 parallel lanes, 3 px apart
      ctx.beginPath();
      for (var lane = 0; lane < 4; lane++) {
        var dy = (lane - 1.5) * 3;
        ctx.moveTo(snapStroke(x1), snapStroke(y1 + dy));
        ctx.lineTo(snapStroke(x2), snapStroke(y2 + dy));
      }
      ctx.stroke();
      ctx.restore();
      return 4;
    } else if (style === 'bus-trunk') {
      // Heavier bus trunk
      ctx.lineWidth = Math.max(w, 1.0);
    }

    ctx.beginPath();
    ctx.moveTo(snapStroke(x1), snapStroke(y1));
    ctx.lineTo(snapStroke(x2), snapStroke(y2));
    ctx.stroke();
    ctx.restore();
    return 1;
  }

  /**
   * Draw the canonical byte chip in the topic's timbre shape.
   * `shape` is one of the v2.3 allowed enum values.
   */
  function drawChip(ctx, x, y, shape, sizePx, paletteToken, alpha) {
    var w = sizePx[0], h = sizePx[1];
    var ox = snapOrigin(x), oy = snapOrigin(y);
    ctx.save();
    ctx.fillStyle = _color(paletteToken || 'instrument-cyan', alpha);

    switch (shape) {
      case 'square':
      case 'rect':
      case 'long-rect': {
        ctx.fillRect(ox, oy, w, h);
        break;
      }
      case 'hex': {
        ctx.beginPath();
        var hw = w / 2, hh = h / 2;
        var qw = w / 4;
        ctx.moveTo(ox - hw + qw, oy - hh);
        ctx.lineTo(ox + hw - qw, oy - hh);
        ctx.lineTo(ox + hw,      oy);
        ctx.lineTo(ox + hw - qw, oy + hh);
        ctx.lineTo(ox - hw + qw, oy + hh);
        ctx.lineTo(ox - hw,      oy);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'triangle': {
        ctx.beginPath();
        ctx.moveTo(ox,           oy - h / 2);
        ctx.lineTo(ox + w / 2,   oy + h / 2);
        ctx.lineTo(ox - w / 2,   oy + h / 2);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'layered': {
        // 3 stacked thin rects suggesting binary structure
        var layerH = h / 3;
        ctx.fillRect(ox, oy,                w, layerH - 1);
        ctx.fillRect(ox, oy + layerH,       w, layerH - 1);
        ctx.fillRect(ox, oy + 2 * layerH,   w, layerH);
        ctx.restore();
        return 3;
      }
      case 'token': {
        // Rect with right-side notch
        ctx.beginPath();
        ctx.moveTo(ox,         oy);
        ctx.lineTo(ox + w - 3, oy);
        ctx.lineTo(ox + w,     oy + h / 2);
        ctx.lineTo(ox + w - 3, oy + h);
        ctx.lineTo(ox,         oy + h);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'envelope': {
        // Rect with diagonal cross suggesting envelope flap
        ctx.fillRect(ox, oy, w, h);
        ctx.strokeStyle = _color('canvas-bg', 0.6);
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(snapStroke(ox), snapStroke(oy));
        ctx.lineTo(snapStroke(ox + w / 2), snapStroke(oy + h / 2));
        ctx.lineTo(snapStroke(ox + w), snapStroke(oy));
        ctx.stroke();
        ctx.restore();
        return 2;
      }
      default: {
        // Unknown shape — should be blocked by audit; defensive fallback
        ctx.fillRect(ox, oy, w, h);
      }
    }
    ctx.restore();
    return 1;
  }

  /**
   * Draw a node (master/slave/peer) at (x, y) with a glyph indicating role.
   */
  function drawNode(ctx, x, y, icon, label) {
    var cx = snapOrigin(x), cy = snapOrigin(y);
    ctx.save();
    ctx.strokeStyle = _color('wire-default');
    ctx.lineWidth = 0.8;
    ctx.fillStyle = _color('canvas-bg');

    switch (icon) {
      case 'plc-rectangle':
      case 'controller-square':
      case 'rtu-square':
      case 'master-rectangle':
      case 'server-rack':
      case 'bmc-square':
      case 'tool-rectangle':
      case 'broadcast-fan': {
        ctx.fillRect(cx - 12, cy - 8, 24, 16);
        ctx.strokeRect(snapStroke(cx - 12), snapStroke(cy - 8), 24, 16);
        break;
      }
      case 'sensor-circle':
      case 'client-circle':
      case 'agent-circle':
      case 'io-device-circle':
      case 'endpoint-circle':
      case 'adapter-circle': {
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'broker-diamond':
      case 'router-diamond':
      case 'resource-diamond':
      case 'as-diamond':
      case 'ca-diamond': {
        ctx.beginPath();
        ctx.moveTo(cx,      cy - 10);
        ctx.lineTo(cx + 10, cy);
        ctx.lineTo(cx,      cy + 10);
        ctx.lineTo(cx - 10, cy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'tower-mesh': {
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // 3 small dots around it suggesting mesh peers
        for (var i = 0; i < 3; i++) {
          var ang = (i / 3) * Math.PI * 2 - Math.PI / 2;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(ang) * 12, cy + Math.sin(ang) * 12, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      default: {
        ctx.fillRect(cx - 8, cy - 8, 16, 16);
      }
    }

    if (label) {
      ctx.fillStyle = _color('instrument-cyan');
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, cx, cy + 22);
    }
    ctx.restore();
    return 1;
  }

  /**
   * ACK ring expanding from receiver node.
   * progress: 0..1 (0 = just emitted, 1 = fully expanded + faded).
   * Per plan §5.5: 400 ms expand + 200 ms fade = 600 ms total.
   */
  function drawACKRing(ctx, x, y, progress, alphaOverride) {
    if (progress < 0 || progress > 1) return 0;
    // Two-phase: 0..2/3 = expand, 2/3..1 = fade
    var radius, alpha;
    if (progress <= 2 / 3) {
      var t = progress / (2 / 3);
      radius = 6 + t * 18;          // 6 → 24 px
      alpha = 1.0;
    } else {
      var t2 = (progress - 2 / 3) / (1 / 3);
      radius = 24;
      alpha = 1.0 - t2;
    }
    if (typeof alphaOverride === 'number') alpha = alphaOverride;

    var cx = snapOrigin(x), cy = snapOrigin(y);
    ctx.save();
    ctx.strokeStyle = _color('oscilloscope-green', alpha);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Centred check glyph during expand phase (a11y glyph-pairing — green ACK)
    if (progress <= 2 / 3 && alpha > 0.3) {
      ctx.fillStyle = _color('oscilloscope-green', alpha);
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', cx, cy);
    }
    ctx.restore();
    return 1;
  }

  function drawCollisionX(ctx, x, y, alpha) {
    var cx = snapOrigin(x), cy = snapOrigin(y);
    ctx.save();
    ctx.fillStyle = _color('fault-red', alpha);
    ctx.font = '14px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('×', cx, cy);
    ctx.restore();
    return 1;
  }

  function drawDropArrow(ctx, x, y, alpha) {
    var cx = snapOrigin(x), cy = snapOrigin(y);
    ctx.save();
    ctx.fillStyle = _color('fault-red', alpha);
    ctx.font = '14px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('↓', cx, cy);
    ctx.restore();
    return 1;
  }

  /**
   * Encrypted scan-line shroud over a wire segment.
   * 1 px horizontal lines, 2 px gap, 30% opacity. Anti-glassmorphism guard:
   * NO blur, NO mix-blend-mode.
   */
  function drawScanlineShroud(ctx, x1, y1, x2, y2) {
    ctx.save();
    ctx.strokeStyle = _color('oscilloscope-green', 0.3);
    ctx.lineWidth = 1;
    var minY = Math.min(y1, y2) - 6;
    var maxY = Math.max(y1, y2) + 6;
    var calls = 0;
    for (var y = minY; y <= maxY; y += 3) {
      ctx.beginPath();
      ctx.moveTo(snapStroke(x1), snapStroke(y));
      ctx.lineTo(snapStroke(x2), snapStroke(y));
      ctx.stroke();
      calls++;
    }
    ctx.restore();
    return calls;
  }

  function measureChip(shape, sizePx) {
    return { w: sizePx[0], h: sizePx[1] };
  }

  window.RZNetAnim.renderer = Object.freeze({
    clear: clear,
    drawWire: drawWire,
    drawChip: drawChip,
    drawNode: drawNode,
    drawACKRing: drawACKRing,
    drawCollisionX: drawCollisionX,
    drawDropArrow: drawDropArrow,
    drawScanlineShroud: drawScanlineShroud,
    measureChip: measureChip,
    _snapStroke: snapStroke,
    _snapOrigin: snapOrigin
  });
})();
