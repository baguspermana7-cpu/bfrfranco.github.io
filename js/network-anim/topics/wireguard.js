/* Network Hub — WireGuard (Lane D, Phase 4).
 * Appendix E row 21. Distinctive: minimalist — no separate handshake animation
 * (peers are pre-keyed); mesh-tunnel always on.
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'sine',     freq: 1500, durationMs: 22 },
    ack:         { waveform: 'sine',     freq: 1900, durationMs: 50 },
    tick:        { waveform: 'square',   freq:  900, durationMs:  6 },
    errorSfx:    { waveform: 'sawtooth', freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',     freq: 1700, durationMs: 60 },
    tempoMultiplier: 1.4,
    registerCharacter: 'minimalist-modern-crypto',
    byteChip: { shape: 'square',      sizePx: [6, 6], color: 'instrument-cyan' },
    wire:     { style: 'mesh-tunnel', widthPx: 1.0 },
    node:     { masterIcon: 'tower-mesh', slaveIcon: 'tower-mesh', tertiaryIcons: ['tower-mesh'] },
    errorSignature: 'cert-mismatch-shroud-breaks',
    encryption:     'always',
    latencyClass:   'realtime',
    completeFreq:   1700,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],
    perRole:  { master: { byteFreqShift: 0 }, slave: { byteFreqShift: -100 } },
    perState: { handshake: { tempoMultiplier: 0.7 }, steady: { tempoMultiplier: 1.0 }, error: { tempoMultiplier: 1.0 } }
  });

  // 3 peers in a mesh — packets bounce between them
  var PEER_POSITIONS = [
    { x: 200, y: 130, label: 'PEER A' },
    { x: 600, y: 130, label: 'PEER B' },
    { x: 400, y: 290, label: 'PEER C' }
  ];
  var FRAMES_PER_HOP = 24;

  function decodeFrame(f) {
    var hops = 6;  // 6 hops cycle through mesh edges
    var totalF = hops * FRAMES_PER_HOP;
    var cf = f % totalF;
    var hopIdx = Math.floor(cf / FRAMES_PER_HOP);
    var pairs = [[0, 1], [1, 2], [2, 0], [0, 2], [2, 1], [1, 0]];
    return { phase: 'mesh-hop', byteIndex: hopIdx, byteProgress: (cf % FRAMES_PER_HOP) / FRAMES_PER_HOP,
             role: hopIdx % 2 === 0 ? 'master' : 'slave',
             srcIdx: pairs[hopIdx][0], dstIdx: pairs[hopIdx][1], totalFrames: totalF };
  }

  function bytePosition(decoded) {
    var src = PEER_POSITIONS[decoded.srcIdx];
    var dst = PEER_POSITIONS[decoded.dstIdx];
    return { x: src.x + (dst.x - src.x) * decoded.byteProgress, y: src.y + (dst.y - src.y) * decoded.byteProgress };
  }

  function init(canvas, params, signals) {
    var ctx = canvas.getContext('2d'); var rafId = 0, running = false, startTs = 0, frame = 0;
    var lastHop = -1;
    var trailStore = window.RZNetAnim.vfx.createTrailStore();

    function render(f) {
      var R = window.RZNetAnim.renderer; R.clear(ctx);
      // Draw mesh wires between all peers
      for (var i = 0; i < PEER_POSITIONS.length; i++) {
        for (var j = i + 1; j < PEER_POSITIONS.length; j++) {
          R.drawWire(ctx, PEER_POSITIONS[i].x, PEER_POSITIONS[i].y, PEER_POSITIONS[j].x, PEER_POSITIONS[j].y, 'ethernet', 0.7);
        }
      }
      // Encryption shroud on every edge (always-on per timbre)
      for (var k = 0; k < PEER_POSITIONS.length; k++) {
        for (var m = k + 1; m < PEER_POSITIONS.length; m++) {
          R.drawScanlineShroud(ctx, PEER_POSITIONS[k].x, PEER_POSITIONS[k].y, PEER_POSITIONS[m].x, PEER_POSITIONS[m].y);
        }
      }
      // Draw peer nodes
      for (var p = 0; p < PEER_POSITIONS.length; p++) {
        R.drawNode(ctx, PEER_POSITIONS[p].x, PEER_POSITIONS[p].y, 'tower-mesh', PEER_POSITIONS[p].label);
      }

      var decoded = decodeFrame(f);
      var pos = bytePosition(decoded);
      trailStore.push(decoded.role, pos.x, pos.y);
      window.RZNetAnim.vfx.drawTrail(ctx, trailStore.get(decoded.role), TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color);
      R.drawChip(ctx, pos.x, pos.y, TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color, 1.0);

      if (signals && signals.onSFX && decoded.byteIndex !== lastHop) {
        signals.onSFX('byte', { role: decoded.role, state: 'steady' });
        lastHop = decoded.byteIndex;
      }

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('instrument-cyan');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · pre-keyed mesh hop ' + decoded.byteIndex + ' · always encrypted', 10, 20);
      ctx.restore();
    }

    function tick(ts) { if (!running) return; if (!startTs) startTs = ts; frame = Math.floor((ts - startTs) / (1000 / 60)); render(frame); rafId = window.requestAnimationFrame(tick); }
    function play()  { if (running) return; running = true; startTs = 0; rafId = window.requestAnimationFrame(tick); }
    function pause() { running = false; if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; } }
    function seek(t) { frame = t; lastHop = -1; trailStore.reset(); render(frame); }
    function setParams() { render(frame); }
    function destroy() { pause(); trailStore.reset(); }
    function getNormalized() { return { effectiveThroughputBps: 1e9, endToEndLatencyMs: 1, frameOverheadBytes: 60, pendingInFlight: 0, isEncrypted: true, isAuthenticated: true, errorCount: 0 }; }

    render(0);
    return { play: play, pause: pause, seek: seek, setParams: setParams, getNormalized: getNormalized, destroy: destroy, timbre: TIMBRE, _decodeFrame: decodeFrame, _bytePosition: bytePosition };
  }

  window.RZNetAnim.wireguard = { _timbre: TIMBRE, init: init };
})();
