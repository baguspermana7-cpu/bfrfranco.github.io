/* ============================================================================
   rz-scrolly.js — scroll-driven step narrative ("scrollytelling") (v1.50.26)
   A pinned canvas evolves as the reader scrolls through step cards.

   Markup:
     <div class="rz-scrolly" data-rz-scrolly>
       <div class="rz-scrolly-canvas"> …sticky SVG/diagram… </div>
       <div class="rz-scrolly-steps">
         <div class="rz-scrolly-step"> …step 0 text… </div>
         <div class="rz-scrolly-step"> …step 1 text… </div> …
       </div>
       <script type="application/json" class="rz-scrolly-cfg">
         { "counters": [ { "day":0, "mw":0, "gpus":0 }, …one object per step… ],
           "duration": 700 }
       </script>
     </div>

   Engine: an IntersectionObserver (band around the viewport middle) activates
   the step crossing it → sets data-step="i" on the container (CSS reveals the
   canvas layers) and animates any <text data-cv="key"> counters in the canvas
   toward that step's targets (rAF lerp; instant under prefers-reduced-motion).
   Zero deps, ES5-safe. Works forwards and backwards.
   ============================================================================ */
(function () {
  'use strict';
  function rzt(type, extra) { try { if (window.rzTrack) window.rzTrack(type, extra); } catch (e) {} }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  function fmtN(v) {
    v = Math.round(v);
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function build(root) {
    var steps = root.querySelectorAll('.rz-scrolly-step');
    if (!steps.length) return;
    var cfg = {};
    var cfgEl = root.querySelector('script.rz-scrolly-cfg');
    if (cfgEl) { try { cfg = JSON.parse(cfgEl.textContent); } catch (e) {} }
    var counters = cfg.counters || [];
    var duration = cfg.duration || 700;

    var cvEls = {};
    [].forEach.call(root.querySelectorAll('[data-cv]'), function (el) {
      cvEls[el.getAttribute('data-cv')] = el;
    });
    var current = {};   /* live counter values */
    var anim = null;

    function setCounters(targets, instant) {
      if (!targets) return;
      if (anim) { cancelAnimationFrame(anim); anim = null; }
      var from = {}, k;
      for (k in targets) from[k] = (typeof current[k] === 'number') ? current[k] : 0;
      if (instant || reduce) {
        for (k in targets) { current[k] = targets[k]; if (cvEls[k]) cvEls[k].textContent = fmtN(targets[k]); }
        return;
      }
      var t0 = null;
      function frame(ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min((ts - t0) / duration, 1);
        var e = 1 - Math.pow(1 - p, 3); /* easeOutCubic */
        for (var k2 in targets) {
          current[k2] = from[k2] + (targets[k2] - from[k2]) * e;
          if (cvEls[k2]) cvEls[k2].textContent = fmtN(current[k2]);
        }
        if (p < 1) anim = requestAnimationFrame(frame); else anim = null;
      }
      anim = requestAnimationFrame(frame);
    }

    var completed = false;
    function activate(i, instant) {
      if (!instant && i === steps.length - 1 && !completed) { completed = true; rzt('rz_scrolly_complete', { steps: steps.length }); }
      root.setAttribute('data-step', String(i));
      [].forEach.call(steps, function (s, j) { s.classList.toggle('active', j === i); });
      setCounters(counters[i], instant);
    }

    activate(0, true);

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var i = [].indexOf.call(steps, en.target);
          if (i >= 0) activate(i, false);
        });
      }, { rootMargin: '-42% 0px -42% 0px', threshold: 0 });
      [].forEach.call(steps, function (s) { io.observe(s); });
    } else {
      activate(steps.length - 1, true); /* no IO: show final state */
    }
  }

  function init() {
    [].forEach.call(document.querySelectorAll('[data-rz-scrolly]'), function (r) {
      try { build(r); } catch (e) { if (window.console) console.warn('rz-scrolly:', e); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
