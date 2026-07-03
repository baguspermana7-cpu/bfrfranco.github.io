/* ============================================================================
   rz-article-diagram.js — LIVING DIAGRAMS for articles (v1.50.25)
   Brings the cockpit animated-schematic language (cdu-mini-bms / chiller-plant:
   CSS dash-flow on SVG paths + a ~1s ticker mutating live values + fault
   scenarios) into the FREE reading flow as a reusable widget.

   Markup:
     <figure class="rz-diagram" data-rz-diagram>
       <svg> …authored schematic…
         paths/groups tagged  data-flow="name"      (animated flow segments)
         value labels         <text data-pv="key">  (live numbers)
         instrument groups    data-inst="key"       (get .warn/.alarm classes)
       </svg>
       <script type="application/json" class="rz-diagram-cfg">
         { "title": "finding sentence",
           "interval": 1000,
           "baselines": { "key": { "v": 32, "unit": "°C", "dp": 1, "noise": 0.4 } },
           "flows":     { "name": "flow" },              // initial flow states
           "scenarios": [ { "id":"...", "label":"Inject: …",
                            "deltas": { "key": +6 },
                            "flows":  { "name": "off" },  // overrides while active
                            "alarms": { "key": "warn" },
                            "msg": "what is happening" } ],
           "source": "…citation…", "basisTag": "illustrative" }
       </script>
     </figure>

   Behavior: scenario buttons (radio-style, "Normal" always first); ticker
   pauses when the figure is offscreen (IntersectionObserver); honours
   prefers-reduced-motion (flow dash animation is disabled by CSS; values still
   tick). Caption + basis chip reuse the .rz-chart-src/.rz-chart-chip styles.
   ES5, zero deps.
   ============================================================================ */
(function () {
  'use strict';

  function fmt(v, dp) { return (dp === 0 || dp) ? v.toFixed(dp) : String(Math.round(v)); }

  function build(fig) {
    var cfgEl = fig.querySelector('script.rz-diagram-cfg');
    var svg = fig.querySelector('svg');
    if (!cfgEl || !svg) return;
    var cfg;
    try { cfg = JSON.parse(cfgEl.textContent); } catch (e) { return; }

    /* title above */
    if (cfg.title && !fig.querySelector('.rz-chart-title')) {
      var h = document.createElement('div');
      h.className = 'rz-chart-title';
      h.textContent = cfg.title;
      fig.insertBefore(h, fig.firstChild);
    }

    /* scenario bar */
    var scen = null; /* active scenario object or null = normal */
    var bar = document.createElement('div');
    bar.className = 'rz-diagram-bar';
    var msg = document.createElement('div');
    msg.className = 'rz-diagram-msg';
    msg.setAttribute('aria-live', 'polite');
    function mkBtn(label, s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rz-diagram-btn';
      b.textContent = label;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        scen = s;
        [].forEach.call(bar.querySelectorAll('.rz-diagram-btn'), function (x) {
          x.classList.remove('active'); x.setAttribute('aria-pressed', 'false');
        });
        b.classList.add('active');
        b.setAttribute('aria-pressed', 'true');
        applyState();
        msg.textContent = s && s.msg ? s.msg : '';
        tick(); /* immediate feedback */
      });
      return b;
    }
    var normalBtn = mkBtn('Normal', null);
    normalBtn.classList.add('active');
    bar.appendChild(normalBtn);
    (cfg.scenarios || []).forEach(function (s) { bar.appendChild(mkBtn(s.label || s.id, s)); });
    fig.insertBefore(bar, svg);
    fig.appendChild(msg);

    /* caption + basis chip (reuse chart styles) */
    if (cfg.source && !fig.querySelector('.rz-chart-src')) {
      var cap = document.createElement('figcaption');
      cap.className = 'rz-chart-src';
      var chip = document.createElement('span');
      var tag = (cfg.basisTag || 'illustrative').toLowerCase();
      chip.className = 'rz-chart-chip ' + ((tag === 'standard' || tag === 'published') ? 'derived' : 'warn');
      chip.textContent = tag.toUpperCase();
      cap.appendChild(chip);
      cap.appendChild(document.createTextNode(' ' + cfg.source));
      fig.appendChild(cap);
    }

    /* flow + alarm state application */
    function applyState() {
      var flows = {};
      var k;
      for (k in (cfg.flows || {})) flows[k] = cfg.flows[k];
      if (scen && scen.flows) for (k in scen.flows) flows[k] = scen.flows[k];
      [].forEach.call(svg.querySelectorAll('[data-flow]'), function (el) {
        var name = el.getAttribute('data-flow');
        var state = flows[name] || 'flow';
        el.classList.remove('flow', 'slow', 'off');
        el.classList.add(state);
      });
      [].forEach.call(svg.querySelectorAll('[data-inst]'), function (el) {
        el.classList.remove('warn', 'alarm');
        var key = el.getAttribute('data-inst');
        if (scen && scen.alarms && scen.alarms[key]) el.classList.add(scen.alarms[key]);
      });
    }

    /* live values ticker */
    var pvEls = {};
    [].forEach.call(svg.querySelectorAll('text[data-pv], tspan[data-pv]'), function (el) {
      pvEls[el.getAttribute('data-pv')] = el;
    });
    function tick() {
      var k, base, delta, noise, v, spec;
      for (k in (cfg.baselines || {})) {
        spec = cfg.baselines[k];
        if (!pvEls[k]) continue;
        /* scenario "exact" pins a value dead (e.g. an offline unit at exactly 0 — no jitter) */
        if (scen && scen.exact && typeof scen.exact[k] === 'number') {
          pvEls[k].textContent = fmt(scen.exact[k], spec.dp) + (spec.unit ? ' ' + spec.unit : '');
          continue;
        }
        base = spec.v;
        delta = (scen && scen.deltas && typeof scen.deltas[k] === 'number') ? scen.deltas[k] : 0;
        noise = (spec.noise || 0) * (Math.random() * 2 - 1);
        v = base + delta + noise;
        if (typeof spec.min === 'number' && v < spec.min) v = spec.min;
        if (typeof spec.max === 'number' && v > spec.max) v = spec.max;
        pvEls[k].textContent = fmt(v, spec.dp) + (spec.unit ? ' ' + spec.unit : '');
      }
    }

    applyState();
    tick();

    /* run only while visible */
    var timer = null;
    function start() { if (!timer) timer = setInterval(tick, cfg.interval || 1000); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) start(); else stop(); });
      }, { threshold: 0.05 }).observe(fig);
    } else { start(); }
  }

  function init() {
    var figs = document.querySelectorAll('[data-rz-diagram]');
    [].forEach.call(figs, function (f) { try { build(f); } catch (e) { if (window.console) console.warn('rz-diagram:', e); } });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
