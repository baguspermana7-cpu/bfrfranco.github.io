/* Network Visualization Hub — EtherCAT topic (Phase 2).
 *
 * Appendix E row 9. Distinctive trait: TELEGRAM PASSES THROUGH every
 * node on-the-fly — the chip doesn't stop at intermediate slaves;
 * each slave reads/modifies "on the wire" as the frame transits.
 *
 * Timbre per audit:
 *   waveform: square (shares with PROFINET)
 *   chip:     rect 6×6 (shares with DNP3)
 *   wire:     bus-trunk (shares with BACnet MS/TP)
 *   master:   master-rectangle (shares with EtherNet/IP)
 *   tempo:    fast 1.7× (shares with TCP, PROFINET, EtherNet/IP)
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'square', freq: 2500, durationMs:  6 },
    ack:         { waveform: 'sine',   freq: 2400, durationMs: 40 },
    tick:        { waveform: 'square', freq: 1300, durationMs:  6 },
    errorSfx:    { waveform: 'sawtooth', freq: 220, durationMs: 80 },
    completeSfx: { waveform: 'sine',   freq: 2100, durationMs: 60 },
    tempoMultiplier: 1.7,
    registerCharacter: 'distributed-clocks-ultra-fast',

    byteChip: { shape: 'rect',      sizePx: [6, 6], color: 'instrument-cyan' },
    wire:     { style: 'bus-trunk', widthPx: 1.0 },
    node:     { masterIcon: 'master-rectangle', slaveIcon: 'sensor-circle', tertiaryIcons: [] },

    errorSignature: 'frame-loss-trail-cut',
    encryption:     'none',
    latencyClass:   'realtime',
    completeFreq:   2100,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],

    perRole: { master: { byteFreqShift: 0 }, slave: { byteFreqShift: -100 } },
    perState: { handshake: { tempoMultiplier: 0.7 }, steady: { tempoMultiplier: 1.0 }, error: { tempoMultiplier: 1.0 } }
  });

  var FPB = 4;                  // EtherCAT is ultra-fast
  var TELEGRAM_BYTES = 8;
  var WIRE_LEFT_X = 80, WIRE_RIGHT_X = 720, WIRE_Y = 200;
  var WIRE_LEN = WIRE_RIGHT_X - WIRE_LEFT_X;
  // 4 daisy-chained slaves between master (left) and ring-return (right)
  var SLAVE_COUNT_DEFAULT = 4;

  function decodeFrame(f, slaveCount) {
    slaveCount = slaveCount || SLAVE_COUNT_DEFAULT;
    // One telegram traverses the wire and returns. Total cycle = traverse + return.
    var traverseF = TELEGRAM_BYTES * FPB * 2;   // x2 for round-trip
    var cf = f % traverseF;
    var direction = cf < traverseF / 2 ? 'forward' : 'return';
    var localF = direction === 'forward' ? cf : cf - traverseF / 2;
    var progress = localF / (traverseF / 2);
    var bi = Math.floor(localF / FPB);
    return {
      phase: direction === 'forward' ? 'telegram-out' : 'telegram-return',
      byteIndex: bi,
      byteProgress: progress,
      role: 'master',
      slaveCount: slaveCount,
      totalFrames: traverseF
    };
  }

  function bytePosition(decoded) {
    var p = decoded.byteProgress;
    if (decoded.phase === 'telegram-out') {
      return { x: WIRE_LEFT_X + p * WIRE_LEN, y: WIRE_Y };
    }
    return { x: WIRE_RIGHT_X - p * WIRE_LEN, y: WIRE_Y };
  }

  function init(canvas, params, signals) {
    var _params = Object.assign({ slaveCount: 4, cycleMs: 1, lineNoise: 0 }, params || {});
    var ctx = canvas.getContext('2d');
    var rafId = 0, running = false, startTs = 0, frame = 0;
    var lastByteIdx = -1, lastPhase = '';
    var trailStore = window.RZNetAnim.vfx.createTrailStore();

    function render(f) {
      var R = window.RZNetAnim.renderer;
      R.clear(ctx);

      // Bus-trunk wire
      R.drawWire(ctx, WIRE_LEFT_X, WIRE_Y, WIRE_RIGHT_X, WIRE_Y, TIMBRE.wire.style, TIMBRE.wire.widthPx);

      // Master at left, slave chain
      R.drawNode(ctx, WIRE_LEFT_X - 30, WIRE_Y, TIMBRE.node.masterIcon, 'MASTER');
      var slaveCount = _params.slaveCount || 4;
      for (var i = 0; i < slaveCount; i++) {
        var sx = WIRE_LEFT_X + ((i + 1) * WIRE_LEN / (slaveCount + 1));
        R.drawNode(ctx, sx, WIRE_Y, TIMBRE.node.slaveIcon, 'S' + (i + 1));
      }

      var decoded = decodeFrame(f, slaveCount);
      var pos = bytePosition(decoded);

      // Telegram doesn't stop — it passes through each slave on-the-fly.
      // Trail length kept short (2 segments) but always-flowing.
      trailStore.push('telegram', pos.x, pos.y);
      window.RZNetAnim.vfx.drawTrail(ctx, trailStore.get('telegram'),
        TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color);
      R.drawChip(ctx, pos.x, pos.y, TIMBRE.byteChip.shape,
                 TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color, 1.0);

      // Highlight nearest slave as the chip passes (read/modify on-the-fly)
      var nearestSlave = -1;
      var nearestDist = Infinity;
      for (var k = 0; k < slaveCount; k++) {
        var ksx = WIRE_LEFT_X + ((k + 1) * WIRE_LEN / (slaveCount + 1));
        var d = Math.abs(ksx - pos.x);
        if (d < nearestDist) { nearestDist = d; nearestSlave = k; }
      }
      if (nearestSlave >= 0 && nearestDist < 30) {
        var hsx = WIRE_LEFT_X + ((nearestSlave + 1) * WIRE_LEN / (slaveCount + 1));
        ctx.save();
        ctx.strokeStyle = window.RZNetAnim.palette.color('oscilloscope-green');
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(hsx, WIRE_Y, 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (signals && signals.onSFX && (decoded.byteIndex !== lastByteIdx || decoded.phase !== lastPhase)) {
        signals.onSFX('byte', { role: 'master', state: 'steady' });
        lastByteIdx = decoded.byteIndex; lastPhase = decoded.phase;
      }

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('wire-default');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · ' + decoded.phase + ' · ' + _params.cycleMs + ' ms cycle · ' + slaveCount + ' slaves', 10, 20);
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
      var cyclesPerSec = 1000 / _params.cycleMs;
      var bytesPerCycle = TELEGRAM_BYTES * (_params.slaveCount || 4);
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

  window.RZNetAnim.ethercat = { _timbre: TIMBRE, init: init };
})();
