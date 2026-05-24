/* Network Visualization Hub — OPC-UA topic module (Phase 1).
 *
 * Per plan §5.6 + Appendix E row 5. Distinctive trait: layered chip
 * (3 stacked rects) visually encodes the OPC binary message structure
 * (message header / sequence header / body).
 *
 * Timbre differentiation (vs RTU / TCP / BACnet-IP):
 *   waveform: sine-sweep    (RTU=square-sweep, TCP=sine, BACnet=triangle) ← DIFFER all
 *   chip:     layered 10×8  (RTU=square, TCP=rect, BACnet=hex)            ← DIFFER all
 *   wire:     ethernet      (TCP+BACnet share)                            ← 1 share each with TCP, BACnet
 *   master:   broker-diamond (all others differ)                          ← DIFFER all
 *   tempo:    1.2× medium   (RTU+BACnet share medium)                     ← 1 share each with RTU, BACnet
 *
 * Pairwise: vs RTU = 1 (tempo medium), vs TCP = 1 (wire ethernet),
 * vs BACnet = 2 (wire ethernet + tempo medium). All ≤2 — passes audit.
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'sine-sweep', freqStart: 1400, freqEnd: 1700, durationMs: 10 },
    ack:         { waveform: 'sine',       freq: 2100, durationMs: 60 },
    tick:        { waveform: 'square',     freq: 1100, durationMs:  6 },
    errorSfx:    { waveform: 'sawtooth',   freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',       freq: 1900, durationMs: 100 },
    tempoMultiplier: 1.2,
    registerCharacter: 'industrial-plc-structured-binary',

    byteChip: { shape: 'layered', sizePx: [10, 8], color: 'instrument-cyan' },
    wire:     { style: 'ethernet', widthPx: 1.0 },
    node:     { masterIcon: 'broker-diamond', slaveIcon: 'sensor-circle', tertiaryIcons: ['server-rack'] },

    errorSignature: 'crc-fail-bytes-corrupt',
    encryption:     'progressive',   // OPC-UA can negotiate security
    latencyClass:   'interactive',
    completeFreq:   1900,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],

    perRole: {
      master: { byteFreqShift:    0 },
      slave:  { byteFreqShift: -100 },
      broker: { byteFreqShift:  100 }
    },
    perState: {
      handshake: { tempoMultiplier: 0.7 },
      steady:    { tempoMultiplier: 1.0 },
      error:     { tempoMultiplier: 1.0 }
    }
  });

  // ─── Animation: OPC-UA subscription model ───────────────────────────
  // Client subscribes → server pushes data updates periodically.
  // Visualisation: client sends Subscribe; server emits data updates
  // (variable cadence depending on publishingIntervalMs).
  var FRAMES_PER_BYTE       = 9;
  var SUBSCRIBE_BYTES       = 16;     // CreateSubscription request size
  var DATA_PUSH_BYTES       = 18;     // PublishResponse with one MonitoredItem
  var WIRE_LEFT_X           = 100;
  var WIRE_RIGHT_X          = 700;
  var WIRE_Y                = 200;
  var WIRE_LEN              = WIRE_RIGHT_X - WIRE_LEFT_X;

  function publishIntervalFrames(publishMs) {
    // visualisation scale — clamp for readability
    return Math.max(30, Math.min(180, Math.round(publishMs / 16.67)));
  }

  function decodeFrame(f, publishingIntervalMs) {
    var fpb = FRAMES_PER_BYTE;
    var subFrames  = SUBSCRIBE_BYTES * fpb;
    var pubInterval = publishIntervalFrames(publishingIntervalMs);
    var pushFrames = DATA_PUSH_BYTES * fpb;
    // After initial Subscribe, server emits DATA_PUSH every pubInterval frames
    if (f < subFrames) {
      var bi = Math.floor(f / fpb);
      return {
        phase: 'subscribe',
        byteIndex: bi,
        byteProgress: (f % fpb) / fpb,
        role: 'master',
        totalFrames: subFrames,
        cyclePhase: 'init'
      };
    }
    var t = f - subFrames;
    // Cycle: pubInterval frames of "silence" then pushFrames of data push
    var cycle = pubInterval + pushFrames;
    var cf = t % cycle;
    if (cf < pubInterval) {
      // Idle interval between publishes
      return { phase: 'wait', byteIndex: -1, byteProgress: cf / pubInterval,
               role: 'slave', totalFrames: cycle, cyclePhase: 'subscribed' };
    }
    var pushIdx = cf - pubInterval;
    var bi2 = Math.floor(pushIdx / fpb);
    return {
      phase: 'push',
      byteIndex: bi2,
      byteProgress: (pushIdx % fpb) / fpb,
      role: 'slave',
      totalFrames: cycle,
      cyclePhase: 'subscribed'
    };
  }

  function bytePosition(decoded) {
    if (decoded.phase === 'subscribe')
      return { x: WIRE_LEFT_X  + decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
    if (decoded.phase === 'push')
      return { x: WIRE_RIGHT_X - decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
    return null;
  }

  function init(canvas, params, signals) {
    var _params = Object.assign({
      publishingIntervalMs: 1000,
      monitoredItems: 5,
      securityMode: 'sign-and-encrypt',
      lineNoise: 0
    }, params || {});

    var ctx = canvas.getContext('2d');
    var rafId = 0;
    var running = false;
    var startTs = 0;
    var frame = 0;
    var lastByteIdxEmitted = -1;
    var lastPhaseEmitted = '';
    var ackStore = window.RZNetAnim.vfx.createACKStore();
    var trailStore = window.RZNetAnim.vfx.createTrailStore();
    var lastPushIdx = -1;

    function emitIfNew(decoded) {
      if (!signals || typeof signals.onSFX !== 'function') return;
      if (decoded.phase === 'subscribe' || decoded.phase === 'push') {
        if (decoded.byteIndex !== lastByteIdxEmitted || decoded.phase !== lastPhaseEmitted) {
          signals.onSFX('byte', { role: decoded.role, state: 'steady' });
          lastByteIdxEmitted = decoded.byteIndex;
          lastPhaseEmitted = decoded.phase;
        }
      }
      // ACK ring at end of each push
      if (decoded.phase === 'push' && decoded.byteIndex === DATA_PUSH_BYTES - 1 && lastPushIdx !== decoded.byteIndex) {
        ackStore.trigger('master', performance.now());
        if (signals.onSFX) signals.onSFX('ack', { role: 'master', state: 'steady' });
      }
      if (decoded.phase === 'push') lastPushIdx = decoded.byteIndex; else lastPushIdx = -1;
    }

    function render(f) {
      var R = window.RZNetAnim.renderer;
      R.clear(ctx);

      // Wire (ethernet 1.0 px)
      R.drawWire(ctx, WIRE_LEFT_X, WIRE_Y, WIRE_RIGHT_X, WIRE_Y,
                 TIMBRE.wire.style, TIMBRE.wire.widthPx);

      // Encryption shroud (always-visible for OPC-UA when securityMode != 'none')
      if (_params.securityMode !== 'none') {
        R.drawScanlineShroud(ctx, WIRE_LEFT_X, WIRE_Y, WIRE_RIGHT_X, WIRE_Y);
      }

      // Nodes — client (broker-diamond), server (sensor-circle), tertiary discovery-server
      R.drawNode(ctx, WIRE_LEFT_X - 30,  WIRE_Y, TIMBRE.node.masterIcon, 'CLIENT');
      R.drawNode(ctx, WIRE_RIGHT_X + 30, WIRE_Y, TIMBRE.node.slaveIcon,  'SERVER');
      // Tertiary discovery server (visual only)
      R.drawNode(ctx, (WIRE_LEFT_X + WIRE_RIGHT_X) / 2, WIRE_Y - 70, 'server-rack', 'DISCOVERY');

      var decoded = decodeFrame(f, _params.publishingIntervalMs);
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
      } else if (decoded.phase === 'wait') {
        ctx.save();
        ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('· subscribed · awaiting next publish (' + _params.publishingIntervalMs + ' ms) ·',
                     (WIRE_LEFT_X + WIRE_RIGHT_X) / 2, WIRE_Y - 18);
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
                   (decoded.byteIndex >= 0 ? ' · byte ' + decoded.byteIndex : ''),
                   10, 20);
      ctx.fillText('subscription: ' + _params.monitoredItems + ' monitored items · ' +
                   _params.securityMode, 10, 36);
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
    function seek(t) { frame = t; lastByteIdxEmitted = -1; lastPhaseEmitted = ''; lastPushIdx = -1; ackStore.reset(); trailStore.reset(); render(frame); }
    function setParams(next) { _params = Object.assign({}, _params, next || {}); render(frame); }
    function destroy() { pause(); ackStore.reset(); trailStore.reset(); }

    function getNormalized() {
      var noiseFactor = 1 - (_params.lineNoise / 100);
      var pushesPerSec = 1000 / _params.publishingIntervalMs;
      var bytesPerPush = DATA_PUSH_BYTES * _params.monitoredItems;
      return {
        effectiveThroughputBps: pushesPerSec * bytesPerPush * 8 * noiseFactor,
        endToEndLatencyMs:      _params.publishingIntervalMs,
        frameOverheadBytes:     16,
        pendingInFlight:        _params.monitoredItems,
        isEncrypted:            _params.securityMode !== 'none',
        isAuthenticated:        _params.securityMode === 'sign-and-encrypt',
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

  window.RZNetAnim.opcUa = { _timbre: TIMBRE, init: init };
})();
