/* Network Visualization Hub — Engine (RAF lifecycle + emit composer).
 *
 * Per plan §5.1 + §5.2 + §5.6 v2.3.
 *
 * Public surface:
 *   RZNetAnim.engine.create(topicInstance, opts) → engine handle
 *     - emit(eventName, ctx)  : compose timbre + play SFX + dispatch VFX
 *     - play / pause / seek   : forwards to topic instance
 *     - destroy()             : releases RAF + audio
 *
 *   opts.signals (optional): { onSFX, onError, onComplete }
 *
 * Phase 0: lifecycle + composition only. Renderer + VFX wiring lands in Phase 1.
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  function create(topicInstance, opts) {
    opts = opts || {};
    var signals = opts.signals || {};
    var rafId = 0;
    var running = false;
    var lastTs = 0;
    var frameCount = 0;

    var timbre = topicInstance && topicInstance.timbre;
    if (!timbre) {
      // Engine never proceeds without a timbre — failing loud catches authoring
      // errors at Phase-0 integration time, not at user-test time.
      throw new Error('[RZNetAnim.engine] topic instance missing required `timbre` property');
    }

    /**
     * Emit a canonical event with timbre composition applied.
     * @param {string} eventName  one of: tick | byte | ack | error | complete |
     *                            handshake | streamChunk | tokenIssue
     * @param {Object} [ctx]      { role?: string, state?: string }
     */
    function emit(eventName, ctx) {
      ctx = ctx || {};
      var role = ctx.role || 'master';
      var state = ctx.state || 'steady';

      var spec = window.RZNetAnim.audio.compose(eventName, timbre, role, state);

      // SFX dispatch
      window.RZNetAnim.audio.play(spec);

      // Signal callback (topic page can wire this to UI / a11y live region)
      if (typeof signals.onSFX === 'function') {
        try { signals.onSFX(eventName, spec, ctx); } catch (_) { /* swallow */ }
      }
      if (eventName === 'error' && typeof signals.onError === 'function') {
        try { signals.onError(spec, ctx); } catch (_) { /* swallow */ }
      }
      if (eventName === 'complete' && typeof signals.onComplete === 'function') {
        try { signals.onComplete(spec, ctx); } catch (_) { /* swallow */ }
      }

      // VFX hook — Phase 1 will route to renderer.drawChip / drawACKRing etc.
      // For now, the audit + integration test can verify emit() ran without throwing.
    }

    function tick(ts) {
      if (!running) return;
      var dt = lastTs ? (ts - lastTs) : 16;
      lastTs = ts;
      frameCount++;
      // Phase 1: walk topic-driven frame → render
      rafId = window.requestAnimationFrame(tick);
    }

    function play() {
      if (running) return;
      running = true;
      lastTs = 0;
      rafId = window.requestAnimationFrame(tick);
      if (topicInstance && typeof topicInstance.play === 'function') topicInstance.play();
    }

    function pause() {
      running = false;
      if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
      if (topicInstance && typeof topicInstance.pause === 'function') topicInstance.pause();
    }

    function seek(frame) {
      frameCount = frame;
      if (topicInstance && typeof topicInstance.seek === 'function') topicInstance.seek(frame);
    }

    function destroy() {
      pause();
      if (topicInstance && typeof topicInstance.destroy === 'function') topicInstance.destroy();
    }

    return {
      emit: emit,
      play: play,
      pause: pause,
      seek: seek,
      destroy: destroy,
      _debugFrameCount: function () { return frameCount; }
    };
  }

  window.RZNetAnim.engine = Object.freeze({ create: create });
})();
