/* Network Visualization Hub — Modbus RTU topic module (Phase 0 + Phase 1 ref).
 *
 * Reference timbre per plan §5.6 + Appendix E row 1.
 * Strategy-A deterministic frame logic: byte positions are pure functions
 * of (frame, baudRate). No accumulated state — every frame derivable from
 * (frame, params).
 *
 * Bus model (simplified for visualisation):
 *   - Master at left, slave at right, single twisted-pair wire
 *   - Request: 8 bytes (addr, fc, startHi, startLo, countHi, countLo, crcHi, crcLo)
 *   - Turnaround: silent interval (3.5 char times ~= 4 byte-frames at default)
 *   - Response: payloadBytes + 5 (addr, fc, byteCount, ...payload..., crcHi, crcLo)
 *   - ACK ring fires at end of response
 *   - Loop indefinitely (one transaction = one cycle)
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  // ════════════════════════════════════════════════════════════════════
  //  TIMBRE PROFILE — Appendix E row 1 reference
  // ════════════════════════════════════════════════════════════════════
  var TIMBRE = Object.freeze({
    byte:        { waveform: 'square-sweep', freqStart: 1200, freqEnd: 1600, durationMs: 12 },
    ack:         { waveform: 'sine',          freq: 1800,     durationMs: 60 },
    tick:        { waveform: 'square',        freq:  800,     durationMs:  6 },
    errorSfx:    { waveform: 'sawtooth',      freq:  220,     durationMs: 80 },
    completeSfx: { waveform: 'sine',          freq: 1500,     durationMs: 80 },
    tempoMultiplier: 1.0,
    registerCharacter: 'modem-v21',

    byteChip: { shape: 'square',      sizePx: [8, 8], color: 'instrument-cyan' },
    wire:     { style: 'serial-thin', widthPx: 0.7 },
    node:     { masterIcon: 'plc-rectangle', slaveIcon: 'sensor-circle', tertiaryIcons: [] },

    errorSignature: 'crc-fail-bytes-corrupt',
    encryption:     'none',
    latencyClass:   'interactive',
    completeFreq:   1500,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],

    perRole: {
      master: { byteFreqShift:    0, waveform: 'square-sweep' },
      slave:  { byteFreqShift: -200, waveform: 'square-sweep' }
    },
    perState: {
      handshake: { tempoMultiplier: 0.7, ackToneShift: +200 },
      steady:    { tempoMultiplier: 1.0 },
      error:     { tempoMultiplier: 1.0 }  // LOCKED
    }
  });

  // ════════════════════════════════════════════════════════════════════
  //  ANIMATION CONSTANTS (Strategy A — derivable)
  // ════════════════════════════════════════════════════════════════════
  // Frames per byte at default 9600 baud (visualisation scale, not wall-clock)
  var FRAMES_PER_BYTE_AT_9600 = 30;     // ~500 ms per byte at 60 fps
  var TURNAROUND_FRAMES_AT_9600 = 4 * FRAMES_PER_BYTE_AT_9600;  // 3.5 char times rounded
  var REQUEST_BYTES = 8;
  var WIRE_LEFT_X = 100;
  var WIRE_RIGHT_X = 700;
  var WIRE_Y = 200;
  var WIRE_LEN = WIRE_RIGHT_X - WIRE_LEFT_X;

  function framesPerByte(baudRate) {
    // baud-scaled: 9600 → 30 fpb; 19200 → 15 fpb; 115200 → 2.5 fpb (floor 6 for visibility)
    return Math.max(6, Math.round(FRAMES_PER_BYTE_AT_9600 * (9600 / baudRate)));
  }

  function turnaroundFrames(baudRate) {
    return 4 * framesPerByte(baudRate);
  }

  /**
   * Pure function: at frame f, what's happening?
   * Returns { phase, byteIndex, byteProgress (0..1), role, totalFrames }
   */
  function decodeFrame(f, baudRate, payloadBytes) {
    var fpb = framesPerByte(baudRate);
    var ta = turnaroundFrames(baudRate);
    var responseBytes = payloadBytes + 5;

    var requestFrames  = REQUEST_BYTES * fpb;
    var responseFrames = responseBytes * fpb;
    var ackFrames = 60;                       // ACK ring lifecycle 600 ms ≈ 36 frames @ 60 fps; pad to 60
    var cycleFrames = requestFrames + ta + responseFrames + ackFrames;

    var cycleFrame = f % cycleFrames;

    if (cycleFrame < requestFrames) {
      var byteIdx = Math.floor(cycleFrame / fpb);
      var prog = (cycleFrame % fpb) / fpb;
      return { phase: 'request', byteIndex: byteIdx, byteProgress: prog, role: 'master', totalFrames: cycleFrames };
    }
    cycleFrame -= requestFrames;
    if (cycleFrame < ta) {
      return { phase: 'turnaround', byteIndex: -1, byteProgress: cycleFrame / ta, role: 'master', totalFrames: cycleFrames };
    }
    cycleFrame -= ta;
    if (cycleFrame < responseFrames) {
      var byteIdx2 = Math.floor(cycleFrame / fpb);
      var prog2 = (cycleFrame % fpb) / fpb;
      return { phase: 'response', byteIndex: byteIdx2, byteProgress: prog2, role: 'slave', totalFrames: cycleFrames };
    }
    cycleFrame -= responseFrames;
    return { phase: 'ack', byteIndex: -1, byteProgress: cycleFrame / ackFrames, role: 'master', totalFrames: cycleFrames };
  }

  /**
   * Pure function: byte position in pixels.
   * Master→slave = left to right (request); slave→master = right to left (response).
   */
  function bytePosition(decoded) {
    if (decoded.phase === 'request') {
      return {
        x: WIRE_LEFT_X + decoded.byteProgress * WIRE_LEN,
        y: WIRE_Y
      };
    }
    if (decoded.phase === 'response') {
      return {
        x: WIRE_RIGHT_X - decoded.byteProgress * WIRE_LEN,
        y: WIRE_Y
      };
    }
    return null;
  }

  // ════════════════════════════════════════════════════════════════════
  //  init() — returns instance with timbre + animation contract
  // ════════════════════════════════════════════════════════════════════
  function init(canvas, params, signals) {
    var _params = Object.assign({
      baudRate: 9600,
      parity: 'even',
      stopBits: 1,
      slaveAddr: 1,
      fcCode: 3,
      payloadBytes: 8,
      turnaroundMs: 5,
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

      // Wire
      R.drawWire(ctx, WIRE_LEFT_X, WIRE_Y, WIRE_RIGHT_X, WIRE_Y,
                 TIMBRE.wire.style, TIMBRE.wire.widthPx);

      // Nodes
      R.drawNode(ctx, WIRE_LEFT_X - 30,  WIRE_Y, TIMBRE.node.masterIcon, 'MASTER');
      R.drawNode(ctx, WIRE_RIGHT_X + 30, WIRE_Y, TIMBRE.node.slaveIcon,  'SLAVE');

      // Current byte position
      var decoded = decodeFrame(f, _params.baudRate, _params.payloadBytes);
      var pos = bytePosition(decoded);

      if (pos) {
        // Per-role chip color: slave bytes lean slightly darker via alpha
        // (visual companion to the perRole.slave.byteFreqShift = -200 Hz audio dim)
        var alpha = (decoded.role === 'slave') ? 0.85 : 1.0;

        // Trail (≤2 segments)
        trailStore.push(decoded.role, pos.x, pos.y);
        window.RZNetAnim.vfx.drawTrail(
          ctx, trailStore.get(decoded.role),
          TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color
        );
        // Lead chip
        R.drawChip(ctx, pos.x, pos.y, TIMBRE.byteChip.shape,
                   TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color, alpha);
      } else if (decoded.phase === 'turnaround') {
        // Show "turnaround silent interval" label
        ctx.save();
        ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('· silent interval ·', (WIRE_LEFT_X + WIRE_RIGHT_X) / 2, WIRE_Y - 18);
        ctx.restore();
        // Clear trails between phases
        trailStore.reset();
      }

      // ACK ring (always check even outside ack phase — it expires on its own)
      var ackProg = ackStore.tick('master', performance.now());
      if (ackProg >= 0) {
        R.drawACKRing(ctx, WIRE_LEFT_X - 30, WIRE_Y, ackProg);
      }

      // Phase label (top-left)
      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('wire-default');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · phase: ' + decoded.phase +
                   (decoded.byteIndex >= 0 ? ' · byte ' + decoded.byteIndex : ''),
                   10, 20);
      ctx.restore();

      emitIfNew(decoded);
    }

    function tick(ts) {
      if (!running) return;
      if (!startTs) startTs = ts;
      // 60 fps visualisation clock
      frame = Math.floor((ts - startTs) / (1000 / 60));
      render(frame);
      rafId = window.requestAnimationFrame(tick);
    }

    function play() {
      if (running) return;
      running = true;
      startTs = 0;
      rafId = window.requestAnimationFrame(tick);
    }
    function pause() {
      running = false;
      if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
    }
    function seek(targetFrame) {
      frame = targetFrame;
      // Reset state then derive
      lastByteIdxEmitted = -1;
      lastPhaseEmitted = '';
      ackTriggeredThisCycle = false;
      ackStore.reset();
      trailStore.reset();
      render(frame);
    }
    function setParams(next) {
      _params = Object.assign({}, _params, next || {});
      render(frame);
    }
    function destroy() {
      pause();
      ackStore.reset();
      trailStore.reset();
    }

    function getNormalized() {
      var noiseFactor = 1 - (_params.lineNoise / 100);
      var payload = _params.payloadBytes;
      var frameBytes = payload + 5;
      return {
        effectiveThroughputBps: (_params.baudRate / 10) * noiseFactor * (payload / frameBytes),
        endToEndLatencyMs:      (payload * 8 + 80) / _params.baudRate * 1000 + _params.turnaroundMs,
        frameOverheadBytes:     5,
        pendingInFlight:        0,
        isEncrypted:            false,
        isAuthenticated:        false,
        errorCount:             0
      };
    }

    // Render frame 0 immediately so the canvas isn't blank pre-play
    render(0);

    return {
      play: play,
      pause: pause,
      seek: seek,
      setParams: setParams,
      getNormalized: getNormalized,
      destroy: destroy,
      timbre: TIMBRE,
      _decodeFrame: decodeFrame,        // for determinism test
      _bytePosition: bytePosition       //   "
    };
  }

  window.RZNetAnim.modbusRtu = {
    _timbre: TIMBRE,
    init: init
  };
})();
