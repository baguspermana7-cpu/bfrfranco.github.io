/* Network Visualization Hub — BACnet MS/TP topic (Phase 2).
 *
 * Appendix E row 3. Distinctive trait: token-passing on RS-485 — only the
 * node holding the token may transmit. Token visibly passes between nodes
 * before a data frame is sent.
 *
 * Timbre per audit:
 *   waveform: sine-sweep 900→1100 Hz (shares with OPC-UA + DNP3)
 *   chip:     hex 8×8 (shares with BACnet/IP — both are BACnet)
 *   wire:     bus-trunk (shares with EtherCAT)
 *   master:   controller-square (shares with BACnet/IP + PROFINET)
 *   tempo:    slow 0.8× (unique slow in Lane B)
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'sine-sweep', freqStart:  900, freqEnd: 1100, durationMs: 14 },
    ack:         { waveform: 'sine',       freq: 1600, durationMs: 70 },
    tick:        { waveform: 'square',     freq:  600, durationMs:  6 },
    errorSfx:    { waveform: 'sawtooth',   freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',       freq: 1500, durationMs: 100 },
    tempoMultiplier: 0.8,
    registerCharacter: 'building-automation-analog-serial',

    byteChip: { shape: 'hex',       sizePx: [8, 8], color: 'instrument-cyan' },
    wire:     { style: 'bus-trunk', widthPx: 0.7 },
    node:     { masterIcon: 'controller-square', slaveIcon: 'sensor-circle', tertiaryIcons: [] },

    errorSignature: 'crc-fail-bytes-corrupt',
    encryption:     'none',
    latencyClass:   'batch',
    completeFreq:   1500,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],

    perRole: {
      master:  { byteFreqShift:   0 },
      slave:   { byteFreqShift: -150 },
      token:   { byteFreqShift:  150 }
    },
    perState: { handshake: { tempoMultiplier: 0.7 }, steady: { tempoMultiplier: 1.0 }, error: { tempoMultiplier: 1.0 } }
  });

  var FPB = 12;
  var TOKEN_BYTES = 3;          // small token frame
  var DATA_BYTES_DEFAULT = 8;
  var WIRE_LEFT_X = 100, WIRE_RIGHT_X = 700, WIRE_Y = 200;
  var WIRE_LEN = WIRE_RIGHT_X - WIRE_LEFT_X;

  function decodeFrame(f, dataBytes) {
    dataBytes = dataBytes || DATA_BYTES_DEFAULT;
    // Cycle: token-passes-right → token-arrives → data-frame-left ← reply ← idle
    var tokenF = TOKEN_BYTES * FPB;
    var dataF  = dataBytes * FPB;
    var idleF  = 40;
    var cycleF = tokenF + dataF + idleF;
    var cf = f % cycleF;

    if (cf < tokenF) {
      var bi = Math.floor(cf / FPB);
      return { phase: 'token-pass', byteIndex: bi, byteProgress: (cf % FPB) / FPB,
               role: 'token', totalFrames: cycleF };
    }
    cf -= tokenF;
    if (cf < dataF) {
      var bi2 = Math.floor(cf / FPB);
      return { phase: 'data-frame', byteIndex: bi2, byteProgress: (cf % FPB) / FPB,
               role: 'master', totalFrames: cycleF };
    }
    cf -= dataF;
    return { phase: 'idle', byteIndex: -1, byteProgress: cf / idleF,
             role: 'master', totalFrames: cycleF };
  }

  function bytePosition(decoded) {
    if (decoded.phase === 'token-pass')
      return { x: WIRE_LEFT_X + decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
    if (decoded.phase === 'data-frame')
      return { x: WIRE_LEFT_X + decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
    return null;
  }

  function init(canvas, params, signals) {
    var _params = Object.assign({ dataBytes: 8, nodeCount: 3, baudRate: 76800, lineNoise: 0 }, params || {});
    var ctx = canvas.getContext('2d');
    var rafId = 0, running = false, startTs = 0, frame = 0;
    var lastByteIdx = -1, lastPhase = '';
    var trailStore = window.RZNetAnim.vfx.createTrailStore();

    function render(f) {
      var R = window.RZNetAnim.renderer;
      R.clear(ctx);

      R.drawWire(ctx, WIRE_LEFT_X, WIRE_Y, WIRE_RIGHT_X, WIRE_Y, TIMBRE.wire.style, TIMBRE.wire.widthPx);

      // Multiple nodes along the bus-trunk
      var n = Math.max(2, _params.nodeCount || 3);
      for (var i = 0; i < n; i++) {
        var nx = WIRE_LEFT_X + ((i + 1) * WIRE_LEN / (n + 1));
        R.drawNode(ctx, nx, WIRE_Y, TIMBRE.node.masterIcon, 'N' + (i + 1));
      }

      var decoded = decodeFrame(f, _params.dataBytes);
      var pos = bytePosition(decoded);

      if (pos) {
        trailStore.push(decoded.phase, pos.x, pos.y);
        window.RZNetAnim.vfx.drawTrail(ctx, trailStore.get(decoded.phase),
          TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color);

        // Token chip rendered with amber tint to differentiate from data chip
        var chipColor = decoded.phase === 'token-pass' ? 'signal-amber' : TIMBRE.byteChip.color;
        R.drawChip(ctx, pos.x, pos.y, TIMBRE.byteChip.shape,
                   TIMBRE.byteChip.sizePx, chipColor, 1.0);

        if (decoded.phase === 'token-pass' && decoded.byteIndex === 1) {
          ctx.save();
          ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('TOKEN', pos.x, pos.y - 14);
          ctx.restore();
        }

        if (signals && signals.onSFX && (decoded.byteIndex !== lastByteIdx || decoded.phase !== lastPhase)) {
          signals.onSFX('byte', { role: decoded.role, state: 'steady' });
          lastByteIdx = decoded.byteIndex; lastPhase = decoded.phase;
        }
      } else if (decoded.phase === 'idle') {
        ctx.save();
        ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('· token-rotation idle ·', (WIRE_LEFT_X + WIRE_RIGHT_X) / 2, WIRE_Y - 18);
        ctx.restore();
        trailStore.reset();
      }

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('wire-default');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · phase: ' + decoded.phase + ' · ' + _params.baudRate + ' baud', 10, 20);
      ctx.restore();
    }

    function tick(ts) {
      if (!running) return;
      if (!startTs) startTs = ts;
      frame = Math.floor((ts - startTs) / (1000 / 60));
      render(frame);
      rafId = window.requestAnimationFrame(tick);
    }

    function play()  { if (running) return; running = true; startTs = 0; rafId = window.requestAnimationFrame(tick); }
    function pause() { running = false; if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; } }
    function seek(t) { frame = t; lastByteIdx = -1; lastPhase = ''; trailStore.reset(); render(frame); }
    function setParams(next) { _params = Object.assign({}, _params, next || {}); render(frame); }
    function destroy() { pause(); trailStore.reset(); }

    function getNormalized() {
      var noiseFactor = 1 - (_params.lineNoise / 100);
      var dataBytes = _params.dataBytes;
      var totalFrameBytes = dataBytes + 8;
      return {
        effectiveThroughputBps: (_params.baudRate / 10) * noiseFactor * (dataBytes / totalFrameBytes),
        endToEndLatencyMs:      (TOKEN_BYTES + totalFrameBytes) * 8 / _params.baudRate * 1000,
        frameOverheadBytes:     8,
        pendingInFlight:        0,
        isEncrypted:            false,
        isAuthenticated:        false,
        errorCount:             0
      };
    }

    render(0);
    return { play: play, pause: pause, seek: seek, setParams: setParams,
             getNormalized: getNormalized, destroy: destroy, timbre: TIMBRE,
             _decodeFrame: decodeFrame, _bytePosition: bytePosition };
  }

  window.RZNetAnim.bacnetMstp = { _timbre: TIMBRE, init: init };
})();
