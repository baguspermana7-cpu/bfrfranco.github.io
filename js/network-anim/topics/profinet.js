/* Network Visualization Hub — PROFINET topic (Phase 2).
 *
 * Appendix E row 7. Distinctive trait: sync line ABOVE the wire shows
 * the cyclic deterministic timing — every byte arrives in lockstep with
 * the cycle boundary marked above the data wire.
 *
 * Timbre per audit (max pairwise share = 2):
 *   waveform: square (shares with EtherCAT)
 *   chip:     square 8×8 (shares with Modbus RTU)
 *   wire:     ethernet 1.0 px (shares with TCP, BACnet/IP, OPC-UA, EtherNet/IP)
 *   master:   controller-square (shares with BACnet/IP, BACnet MS/TP)
 *   tempo:    fast 1.6× (shares with TCP, EtherNet/IP, EtherCAT)
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'square',   freq: 2000, durationMs:  8 },
    ack:         { waveform: 'sine',     freq: 2200, durationMs: 40 },
    tick:        { waveform: 'square',   freq: 1500, durationMs:  6 },
    errorSfx:    { waveform: 'sawtooth', freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',     freq: 1900, durationMs: 80 },
    tempoMultiplier: 1.6,
    registerCharacter: 'real-time-industrial-ethernet',

    byteChip: { shape: 'square',   sizePx: [8, 8], color: 'instrument-cyan' },
    wire:     { style: 'ethernet', widthPx: 1.0 },
    node:     { masterIcon: 'controller-square', slaveIcon: 'io-device-circle', tertiaryIcons: [] },

    errorSignature: 'frame-loss-trail-cut',
    encryption:     'none',
    latencyClass:   'realtime',
    completeFreq:   1900,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],

    perRole: { master: { byteFreqShift: 0 }, slave: { byteFreqShift: -200 } },
    perState: { handshake: { tempoMultiplier: 0.7 }, steady: { tempoMultiplier: 1.0 }, error: { tempoMultiplier: 1.0 } }
  });

  var FPB = 6;                  // PROFINET cycles are very fast
  var CYCLE_BYTES = 6;          // small deterministic frame
  var SYNC_HEIGHT_OFFSET = 30;  // sync line drawn above data wire
  var WIRE_LEFT_X = 100, WIRE_RIGHT_X = 700, WIRE_Y = 220;
  var WIRE_LEN = WIRE_RIGHT_X - WIRE_LEFT_X;

  function decodeFrame(f, cycleMs) {
    var cycleFrames = CYCLE_BYTES * FPB;
    var cf = f % cycleFrames;
    var bi = Math.floor(cf / FPB);
    return {
      phase: 'cyclic',
      byteIndex: bi,
      byteProgress: (cf % FPB) / FPB,
      role: bi % 2 === 0 ? 'master' : 'slave',
      cycleStart: cf === 0,
      totalFrames: cycleFrames,
      cycleMs: cycleMs
    };
  }

  function bytePosition(decoded) {
    // bytes traverse left→right then right→left in alternating cycles for visual variety
    var dir = decoded.role === 'master' ? 1 : -1;
    var startX = dir > 0 ? WIRE_LEFT_X : WIRE_RIGHT_X;
    return { x: startX + dir * decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
  }

  function init(canvas, params, signals) {
    var _params = Object.assign({ cycleMs: 4, lineNoise: 0 }, params || {});
    var ctx = canvas.getContext('2d');
    var rafId = 0, running = false, startTs = 0, frame = 0;
    var lastByteIdx = -1, lastPhase = '';
    var ackStore = window.RZNetAnim.vfx.createACKStore();
    var trailStore = window.RZNetAnim.vfx.createTrailStore();

    function render(f) {
      var R = window.RZNetAnim.renderer;
      R.clear(ctx);

      // Sync timing line ABOVE the data wire — distinctive trait
      ctx.save();
      ctx.strokeStyle = window.RZNetAnim.palette.color('signal-amber');
      ctx.lineWidth = 0.6;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(WIRE_LEFT_X,  R._snapStroke ? R._snapStroke(WIRE_Y - SYNC_HEIGHT_OFFSET) : WIRE_Y - SYNC_HEIGHT_OFFSET);
      ctx.lineTo(WIRE_RIGHT_X, R._snapStroke ? R._snapStroke(WIRE_Y - SYNC_HEIGHT_OFFSET) : WIRE_Y - SYNC_HEIGHT_OFFSET);
      ctx.stroke();
      ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('sync · ' + _params.cycleMs + ' ms cycle', WIRE_RIGHT_X, WIRE_Y - SYNC_HEIGHT_OFFSET - 4);
      ctx.restore();

      // Data wire
      R.drawWire(ctx, WIRE_LEFT_X, WIRE_Y, WIRE_RIGHT_X, WIRE_Y, TIMBRE.wire.style, TIMBRE.wire.widthPx);
      R.drawNode(ctx, WIRE_LEFT_X - 30,  WIRE_Y, TIMBRE.node.masterIcon, 'CONTROLLER');
      R.drawNode(ctx, WIRE_RIGHT_X + 30, WIRE_Y, TIMBRE.node.slaveIcon,  'IO DEVICE');

      var decoded = decodeFrame(f, _params.cycleMs);
      var pos = bytePosition(decoded);

      var alpha = (decoded.role === 'slave') ? 0.85 : 1.0;
      trailStore.push(decoded.role, pos.x, pos.y);
      window.RZNetAnim.vfx.drawTrail(ctx, trailStore.get(decoded.role),
        TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color);
      R.drawChip(ctx, pos.x, pos.y, TIMBRE.byteChip.shape,
                 TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color, alpha);

      // Cycle-boundary tick mark on the sync line
      if (decoded.cycleStart) {
        ctx.save();
        ctx.strokeStyle = window.RZNetAnim.palette.color('oscilloscope-green');
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(WIRE_LEFT_X, WIRE_Y - SYNC_HEIGHT_OFFSET - 4);
        ctx.lineTo(WIRE_LEFT_X, WIRE_Y - SYNC_HEIGHT_OFFSET + 4);
        ctx.stroke();
        ctx.restore();
      }

      if (signals && signals.onSFX && (decoded.byteIndex !== lastByteIdx || decoded.phase !== lastPhase)) {
        signals.onSFX('byte', { role: decoded.role, state: 'steady' });
        lastByteIdx = decoded.byteIndex; lastPhase = decoded.phase;
      }

      var ackProg = ackStore.tick('master', performance.now());
      if (ackProg >= 0) R.drawACKRing(ctx, WIRE_LEFT_X - 30, WIRE_Y, ackProg);

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('wire-default');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · cyclic byte ' + decoded.byteIndex + ' · ' + _params.cycleMs + ' ms cycle', 10, 20);
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
    function seek(t) { frame = t; lastByteIdx = -1; lastPhase = ''; ackStore.reset(); trailStore.reset(); render(frame); }
    function setParams(next) { _params = Object.assign({}, _params, next || {}); render(frame); }
    function destroy() { pause(); ackStore.reset(); trailStore.reset(); }

    function getNormalized() {
      var cyclesPerSec = 1000 / _params.cycleMs;
      var bytesPerCycle = CYCLE_BYTES;
      var noiseFactor = 1 - (_params.lineNoise / 100);
      return {
        effectiveThroughputBps: cyclesPerSec * bytesPerCycle * 8 * noiseFactor,
        endToEndLatencyMs:      _params.cycleMs,
        frameOverheadBytes:     2,
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

  window.RZNetAnim.profinet = { _timbre: TIMBRE, init: init };
})();
