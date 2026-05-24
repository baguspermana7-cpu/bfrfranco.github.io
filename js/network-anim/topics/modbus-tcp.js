/* Network Visualization Hub — Modbus TCP topic module (Phase 1).
 *
 * Per plan §5.6 + Appendix E row 2. Distinctive trait: MBAP header chip
 * visibly larger than the byte chip — overhead becomes visible without a
 * separate annotation.
 *
 * Timbre differentiation vs Modbus RTU (Appendix E + audit gate):
 *   waveform: sine            (RTU = square-sweep)   ← DIFFER
 *   chip:     rect 12×6       (RTU = square 8×8)     ← DIFFER
 *   wire:     ethernet 1.0 px (RTU = serial-thin)    ← DIFFER
 *   master:   server-rack     (RTU = plc-rectangle)  ← DIFFER
 *   tempo:    1.5× (fast bin) (RTU = 1.0× medium)    ← DIFFER
 *
 * Shared with RTU: 0 fields. Anti-monotony gate passes by a wide margin.
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'sine',     freq: 1300, durationMs: 10 },
    ack:         { waveform: 'sine',     freq: 2000, durationMs: 50 },
    tick:        { waveform: 'square',   freq: 1000, durationMs:  6 },
    errorSfx:    { waveform: 'sawtooth', freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',     freq: 1800, durationMs: 80 },
    tempoMultiplier: 1.5,
    registerCharacter: 'modem-v21-over-ethernet',

    byteChip: { shape: 'rect',     sizePx: [12, 6], color: 'instrument-cyan' },
    wire:     { style: 'ethernet', widthPx: 1.0 },
    node:     { masterIcon: 'server-rack', slaveIcon: 'sensor-circle', tertiaryIcons: [] },

    errorSignature: 'crc-fail-bytes-corrupt',
    encryption:     'none',
    latencyClass:   'interactive',
    completeFreq:   1800,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],

    perRole: {
      master: { byteFreqShift:    0 },
      slave:  { byteFreqShift: -200 }
    },
    perState: {
      handshake: { tempoMultiplier: 0.7 },
      steady:    { tempoMultiplier: 1.0 },
      error:     { tempoMultiplier: 1.0 }   // LOCKED
    }
  });

  // ─── Animation constants ────────────────────────────────────────────
  // TCP is faster than RTU. Visualisation scales accordingly.
  var FRAMES_PER_BYTE_AT_100M = 8;       // base frame rate per byte
  var REQUEST_BYTES   = 12;              // MBAP (7) + PDU (5)
  var MBAP_BYTES      = 7;               // MBAP header bytes
  var WIRE_LEFT_X     = 100;
  var WIRE_RIGHT_X    = 700;
  var WIRE_Y          = 200;
  var WIRE_LEN        = WIRE_RIGHT_X - WIRE_LEFT_X;
  var TURNAROUND_FRAMES = 12;            // TCP turnaround visibly shorter

  function framesPerByte() {
    // TCP runs at link speed; we visualise at fixed cadence for clarity
    return FRAMES_PER_BYTE_AT_100M;
  }

  function decodeFrame(f, payloadBytes) {
    var fpb = framesPerByte();
    var responseBytes = MBAP_BYTES + 2 + payloadBytes + 1; // MBAP + fc + bytecount + data + endmarker
    var requestFrames  = REQUEST_BYTES  * fpb;
    var responseFrames = responseBytes  * fpb;
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
        isMbap: bi < MBAP_BYTES,
        totalFrames: cycleFrames
      };
    }
    cf -= requestFrames;
    if (cf < TURNAROUND_FRAMES) {
      return { phase: 'turnaround', byteIndex: -1, byteProgress: cf / TURNAROUND_FRAMES,
               role: 'master', isMbap: false, totalFrames: cycleFrames };
    }
    cf -= TURNAROUND_FRAMES;
    if (cf < responseFrames) {
      var bi2 = Math.floor(cf / fpb);
      return {
        phase: 'response',
        byteIndex: bi2,
        byteProgress: (cf % fpb) / fpb,
        role: 'slave',
        isMbap: bi2 < MBAP_BYTES,
        totalFrames: cycleFrames
      };
    }
    cf -= responseFrames;
    return { phase: 'ack', byteIndex: -1, byteProgress: cf / ackFrames,
             role: 'master', isMbap: false, totalFrames: cycleFrames };
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
      payloadBytes: 8,
      linkSpeedMbps: 100,
      tcpRttMs: 1,
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

      // Wire (ethernet style, 1.0 px)
      R.drawWire(ctx, WIRE_LEFT_X, WIRE_Y, WIRE_RIGHT_X, WIRE_Y,
                 TIMBRE.wire.style, TIMBRE.wire.widthPx);

      // Nodes — server racks both sides (TCP is server-to-server)
      R.drawNode(ctx, WIRE_LEFT_X - 30,  WIRE_Y, TIMBRE.node.masterIcon, 'CLIENT');
      R.drawNode(ctx, WIRE_RIGHT_X + 30, WIRE_Y, TIMBRE.node.slaveIcon,  'SERVER');

      var decoded = decodeFrame(f, _params.payloadBytes);
      var pos = bytePosition(decoded);

      if (pos) {
        var alpha = (decoded.role === 'slave') ? 0.85 : 1.0;

        // Trail
        trailStore.push(decoded.role, pos.x, pos.y);
        window.RZNetAnim.vfx.drawTrail(
          ctx, trailStore.get(decoded.role),
          TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color
        );

        // MBAP header chip is LARGER (distinctive trait per Appendix E)
        var size = decoded.isMbap ? [16, 8] : TIMBRE.byteChip.sizePx;
        R.drawChip(ctx, pos.x, pos.y, TIMBRE.byteChip.shape, size,
                   TIMBRE.byteChip.color, alpha);

        // MBAP label hint
        if (decoded.isMbap && decoded.byteIndex === 3) {
          ctx.save();
          ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('MBAP header (7 B)', pos.x, pos.y - 14);
          ctx.restore();
        }
      } else if (decoded.phase === 'turnaround') {
        ctx.save();
        ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('· TCP RTT ·', (WIRE_LEFT_X + WIRE_RIGHT_X) / 2, WIRE_Y - 18);
        ctx.restore();
        trailStore.reset();
      }

      // ACK ring on client side
      var ackProg = ackStore.tick('master', performance.now());
      if (ackProg >= 0) {
        R.drawACKRing(ctx, WIRE_LEFT_X - 30, WIRE_Y, ackProg);
      }

      // Phase label
      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('wire-default');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · phase: ' + decoded.phase +
                   (decoded.byteIndex >= 0 ? ' · byte ' + decoded.byteIndex +
                    (decoded.isMbap ? ' (MBAP)' : ' (PDU)') : ''),
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
      var totalBytes = payload + 7; // MBAP header overhead
      return {
        effectiveThroughputBps: (_params.linkSpeedMbps * 1e6 / 8) * noiseFactor * (payload / totalBytes),
        endToEndLatencyMs:      _params.tcpRttMs + 1,
        frameOverheadBytes:     7,
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

  window.RZNetAnim.modbusTcp = { _timbre: TIMBRE, init: init };
})();
