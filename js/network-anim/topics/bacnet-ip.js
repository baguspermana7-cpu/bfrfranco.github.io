/* Network Visualization Hub — BACnet/IP topic module (Phase 1).
 *
 * Per plan §5.6 + Appendix E row 4. Distinctive trait: BVLC tunnel
 * renders as a brief scan-line shroud segment at packet head (showing
 * where BACnet broadcast/unicast IS encapsulated for IP transport).
 *
 * Timbre differentiation (vs RTU / TCP):
 *   waveform: triangle      (RTU=square-sweep, TCP=sine)            ← DIFFER
 *   chip:     hex 8×8       (RTU=square, TCP=rect)                  ← DIFFER
 *   wire:     ethernet      (RTU=serial-thin)  (TCP=ethernet share) ← 1 share with TCP
 *   master:   controller-square (RTU=plc-rect, TCP=server-rack)     ← DIFFER
 *   tempo:    1.2× medium   (RTU=medium share) (TCP=fast)           ← 1 share with RTU (both medium)
 *
 * Pairwise shares: vs RTU = 1 (tempo-medium), vs TCP = 1 (wire-ethernet).
 * Anti-monotony passes (cap ≤2).
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'triangle', freq:  950, durationMs: 14 },
    ack:         { waveform: 'sine',     freq: 1600, durationMs: 55 },
    tick:        { waveform: 'square',   freq:  900, durationMs:  6 },
    errorSfx:    { waveform: 'sawtooth', freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',     freq: 1700, durationMs: 90 },
    tempoMultiplier: 1.2,
    registerCharacter: 'building-automation-analog-over-ip',

    byteChip: { shape: 'hex',      sizePx: [8, 8], color: 'instrument-cyan' },
    wire:     { style: 'ethernet', widthPx: 1.0 },
    node:     { masterIcon: 'controller-square', slaveIcon: 'sensor-circle', tertiaryIcons: [] },

    errorSignature: 'crc-fail-bytes-corrupt',
    encryption:     'none',
    latencyClass:   'interactive',
    completeFreq:   1700,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],

    perRole: {
      master: { byteFreqShift:    0 },
      slave:  { byteFreqShift: -150 }
    },
    perState: {
      handshake: { tempoMultiplier: 0.7 },
      steady:    { tempoMultiplier: 1.0 },
      error:     { tempoMultiplier: 1.0 }
    }
  });

  // ─── Animation constants ────────────────────────────────────────────
  // BACnet/IP packet model: BVLC (4 B) + NPDU (variable) + APDU (payload)
  var FRAMES_PER_BYTE     = 10;
  var BVLC_BYTES          = 4;        // BVLC header always 4 bytes
  var REQUEST_BYTES       = 14;       // BVLC + NPDU + APDU minimal
  var WIRE_LEFT_X         = 100;
  var WIRE_RIGHT_X        = 700;
  var WIRE_Y              = 200;
  var WIRE_LEN            = WIRE_RIGHT_X - WIRE_LEFT_X;
  var TURNAROUND_FRAMES   = 18;       // Slightly longer for UDP turnaround

  function decodeFrame(f, payloadBytes) {
    var fpb = FRAMES_PER_BYTE;
    var responseBytes = BVLC_BYTES + 6 + payloadBytes;
    var requestFrames  = REQUEST_BYTES * fpb;
    var responseFrames = responseBytes * fpb;
    var ackFrames = 50;
    var cycleFrames = requestFrames + TURNAROUND_FRAMES + responseFrames + ackFrames;
    var cf = f % cycleFrames;

    if (cf < requestFrames) {
      var bi = Math.floor(cf / fpb);
      return {
        phase: 'request',
        byteIndex: bi,
        byteProgress: (cf % fpb) / fpb,
        role: 'master',
        isBvlc: bi < BVLC_BYTES,
        totalFrames: cycleFrames
      };
    }
    cf -= requestFrames;
    if (cf < TURNAROUND_FRAMES) {
      return { phase: 'turnaround', byteIndex: -1, byteProgress: cf / TURNAROUND_FRAMES,
               role: 'master', isBvlc: false, totalFrames: cycleFrames };
    }
    cf -= TURNAROUND_FRAMES;
    if (cf < responseFrames) {
      var bi2 = Math.floor(cf / fpb);
      return {
        phase: 'response',
        byteIndex: bi2,
        byteProgress: (cf % fpb) / fpb,
        role: 'slave',
        isBvlc: bi2 < BVLC_BYTES,
        totalFrames: cycleFrames
      };
    }
    cf -= responseFrames;
    return { phase: 'ack', byteIndex: -1, byteProgress: cf / ackFrames,
             role: 'master', isBvlc: false, totalFrames: cycleFrames };
  }

  function bytePosition(decoded) {
    if (decoded.phase === 'request')
      return { x: WIRE_LEFT_X  + decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
    if (decoded.phase === 'response')
      return { x: WIRE_RIGHT_X - decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
    return null;
  }

  function init(canvas, params, signals) {
    var _params = Object.assign({
      payloadBytes: 12,
      isBroadcast: false,
      udpRttMs: 2,
      lineNoise: 0
    }, params || {});

    var ctx = canvas.getContext('2d');
    var rafId = 0;
    var running = false;
    var startTs = 0;
    var frame = 0;
    var lastByteIdxEmitted = -1;
    var lastPhaseEmitted = '';
    var ackTriggeredThisCycle = false;
    var ackStore = window.RZNetAnim.vfx.createACKStore();
    var trailStore = window.RZNetAnim.vfx.createTrailStore();

    function emitIfNew(decoded) {
      if (!signals || typeof signals.onSFX !== 'function') return;
      if (decoded.phase === 'request' || decoded.phase === 'response') {
        if (decoded.byteIndex !== lastByteIdxEmitted || decoded.phase !== lastPhaseEmitted) {
          signals.onSFX('byte', { role: decoded.role, state: 'steady' });
          lastByteIdxEmitted = decoded.byteIndex;
          lastPhaseEmitted = decoded.phase;
        }
      } else if (decoded.phase === 'ack' && !ackTriggeredThisCycle) {
        signals.onSFX('ack', { role: 'master', state: 'steady' });
        ackStore.trigger('master', performance.now());
        ackTriggeredThisCycle = true;
      }
      if (decoded.phase !== 'ack') ackTriggeredThisCycle = false;
    }

    function render(f) {
      var R = window.RZNetAnim.renderer;
      R.clear(ctx);

      R.drawWire(ctx, WIRE_LEFT_X, WIRE_Y, WIRE_RIGHT_X, WIRE_Y,
                 TIMBRE.wire.style, TIMBRE.wire.widthPx);

      R.drawNode(ctx, WIRE_LEFT_X - 30,  WIRE_Y, TIMBRE.node.masterIcon, 'CONTROLLER');
      R.drawNode(ctx, WIRE_RIGHT_X + 30, WIRE_Y, TIMBRE.node.slaveIcon,  'DEVICE');

      var decoded = decodeFrame(f, _params.payloadBytes);
      var pos = bytePosition(decoded);

      if (pos) {
        var alpha = (decoded.role === 'slave') ? 0.85 : 1.0;

        trailStore.push(decoded.role, pos.x, pos.y);
        window.RZNetAnim.vfx.drawTrail(
          ctx, trailStore.get(decoded.role),
          TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color
        );

        R.drawChip(ctx, pos.x, pos.y, TIMBRE.byteChip.shape,
                   TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color, alpha);

        // BVLC tunnel — scan-line shroud at packet head (distinctive trait)
        if (decoded.isBvlc) {
          R.drawScanlineShroud(ctx, pos.x - 4, pos.y - 4, pos.x + 4, pos.y + 4);
          if (decoded.byteIndex === 2) {
            ctx.save();
            ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
            ctx.font = '10px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('BVLC tunnel (4 B)', pos.x, pos.y - 16);
            ctx.restore();
          }
        }
      } else if (decoded.phase === 'turnaround') {
        ctx.save();
        ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('· UDP turnaround ·', (WIRE_LEFT_X + WIRE_RIGHT_X) / 2, WIRE_Y - 18);
        ctx.restore();
        trailStore.reset();
      }

      var ackProg = ackStore.tick('master', performance.now());
      if (ackProg >= 0) {
        R.drawACKRing(ctx, WIRE_LEFT_X - 30, WIRE_Y, ackProg);
      }

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('wire-default');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · phase: ' + decoded.phase +
                   (decoded.byteIndex >= 0 ? ' · byte ' + decoded.byteIndex +
                    (decoded.isBvlc ? ' (BVLC)' : ' (NPDU/APDU)') : ''),
                   10, 20);
      ctx.restore();

      emitIfNew(decoded);
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
    function seek(t) { frame = t; lastByteIdxEmitted = -1; lastPhaseEmitted = ''; ackTriggeredThisCycle = false; ackStore.reset(); trailStore.reset(); render(frame); }
    function setParams(next) { _params = Object.assign({}, _params, next || {}); render(frame); }
    function destroy() { pause(); ackStore.reset(); trailStore.reset(); }

    function getNormalized() {
      var noiseFactor = 1 - (_params.lineNoise / 100);
      var payload = _params.payloadBytes;
      var totalBytes = payload + 8; // BVLC + NPDU overhead
      return {
        effectiveThroughputBps: (100e6 / 8) * noiseFactor * (payload / totalBytes),
        endToEndLatencyMs:      _params.udpRttMs + 1,
        frameOverheadBytes:     8,
        pendingInFlight:        0,
        isEncrypted:            false,
        isAuthenticated:        false,
        errorCount:             0
      };
    }

    render(0);

    return {
      play: play, pause: pause, seek: seek, setParams: setParams,
      getNormalized: getNormalized, destroy: destroy, timbre: TIMBRE,
      _decodeFrame: decodeFrame, _bytePosition: bytePosition
    };
  }

  window.RZNetAnim.bacnetIp = { _timbre: TIMBRE, init: init };
})();
