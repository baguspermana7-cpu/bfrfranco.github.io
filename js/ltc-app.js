/* ============================================================================
 * ltc-app.js — the LTC Workbench shell
 * ----------------------------------------------------------------------------
 * Shared by the hub and the six standards modules. Owns: the module rail (one
 * list, so seven pages cannot drift), tool tabs with deep-linkable hashes, the
 * inspector, the theme, and the bridge from the RZ diagram engine's hit
 * targets to a page callback. Pages own their tools.
 *
 * Requires (synchronous, before this file): js/rz-eng-symbols.js. Diagrams also
 * need js/rz-diagram-metrics.js, js/rz-diagram-layout.js, js/rz-diagram.js.
 * ==========================================================================*/
(function (root) {
  'use strict';

  var MODULES = [
    { id: 'hub', href: 'standards-ltc-lab.html', code: 'Plant', name: 'Standards map', sym: 'bms' },
    { id: 'model', href: 'ltc-system-modelling-lab.html', code: 'Model', name: 'Liquid-to-chip model', sym: 'cdu' },
    { id: 'ashrae', href: 'ltc-ashrae-thermal-control.html', code: 'ASHRAE', name: 'Thermal envelope', sym: 'tempSensor' },
    { id: 'tier', href: 'ltc-uptime-tier-alignment.html', code: 'Tier', name: 'Topology & maintainability', sym: 'ats' },
    { id: 'tia', href: 'ltc-ansi-tia-topology-readiness.html', code: 'TIA', name: 'Cabling & spaces', sym: 'patchPanel' },
    { id: 'nfpa', href: 'ltc-nfpa-fire-risk.html', code: 'NFPA', name: 'Fire protection', sym: 'aspirating' },
    { id: 'iso', href: 'ltc-iso-energy-governance.html', code: 'ISO', name: 'Energy KPIs', sym: 'meter' }
  ];

  function sym(kind, size) {
    var S = root.RZEngSymbols;
    return S ? S.svg(kind, size || 20) : '';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /** Fixed decimals with thousands separators; '—' for anything not finite. */
  function fmt(n, d) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    return n.toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* ---- theme ------------------------------------------------------------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('theme', t); } catch (e) { /* private mode */ }
    var m = $('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'dark' ? '#0a0e1a' : '#f5f7fa');
    var b = $('#themeToggle');
    if (b) b.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
  function initialTheme() {
    var saved = null;
    try { saved = localStorage.getItem('theme'); } catch (e) { /* ignore */ }
    if (saved === 'dark' || saved === 'light') return saved;
    return root.matchMedia && root.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  /* ---- rail -------------------------------------------------------------- */
  function renderRail(active) {
    var nav = $('#ltcRail');
    if (!nav) return;
    var h = '<div class="ltc-rail-h">Workbench</div>';
    MODULES.forEach(function (m) {
      h += '<a class="ltc-mod" href="' + m.href + '"' + (m.id === active ? ' aria-current="page"' : '') + '>' +
        sym(m.sym, 22) + '<b>' + esc(m.code) + '</b><span>' + esc(m.name) + '</span></a>';
    });
    nav.innerHTML = h;
  }

  /* ---- tabs -------------------------------------------------------------- */
  function initTabs() {
    var tabs = $$('.ltc-tab');
    if (!tabs.length) return;
    function select(id, push) {
      var hit = false;
      tabs.forEach(function (t) {
        var on = t.getAttribute('aria-controls') === id;
        if (on) hit = true;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var p = document.getElementById(t.getAttribute('aria-controls'));
        if (p) p.hidden = !on;
      });
      if (!hit) return false;
      if (push && history.replaceState) history.replaceState(null, '', '#' + id.replace(/^p-/, ''));
      document.dispatchEvent(new CustomEvent('ltc:tab', { detail: { id: id } }));
      return true;
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t.getAttribute('aria-controls'), true); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, j = -1;
        if (k === 'ArrowRight') j = (i + 1) % tabs.length;
        else if (k === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
        if (j < 0) return;
        e.preventDefault();
        tabs[j].focus();
        select(tabs[j].getAttribute('aria-controls'), true);
      });
    });
    var want = (location.hash || '').replace('#', '');
    if (!(want && select('p-' + want, false))) select(tabs[0].getAttribute('aria-controls'), false);
    API.selectTab = function (name) { select('p-' + name, true); };
  }

  /* ---- inspector --------------------------------------------------------- */
  var lastTrigger = null;
  function inspect(o) {
    var box = $('#ltcInsp');
    if (!box) return;
    /* a control inside the inspector is not the trigger to return to */
    if (!box.contains(document.activeElement)) lastTrigger = document.activeElement;
    $('.ltc-insp-h', box).innerHTML =
      (o.sym ? sym(o.sym, 28) : '') +
      '<div><div class="ltc-eyebrow">' + esc(o.eyebrow || '') + '</div><h2>' + esc(o.title || '') + '</h2></div>' +
      '<button class="ltc-iconbtn ltc-insp-close" type="button" aria-label="Close inspector">&times;</button>';
    $('.ltc-insp-b', box).innerHTML = o.html || '';
    var app = $('.ltc-app');
    if (app) app.setAttribute('data-insp', 'open');
    var c = $('.ltc-insp-close', box);
    if (c) c.addEventListener('click', closeInspector);
  }
  function closeInspector() {
    var app = $('.ltc-app');
    if (app) app.removeAttribute('data-insp');
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
  }
  function kv(rows) {
    return '<dl class="ltc-kv">' + rows.map(function (r) {
      return '<dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd>';
    }).join('') + '</dl>';
  }

  /* ---- diagrams ---------------------------------------------------------- */
  /**
   * Draw a figure through the engine into `el`, redraw when the pane crosses
   * the narrow breakpoint, and route hit-target activation to onSelect(id).
   * build(D, ctx) receives {narrow:boolean} and must return the engine ctx.
   * Engine warnings are logged as errors: the standard treats them as
   * failures, and a probe reads the console.
   */
  function draw(el, build, onSelect) {
    var D = root.RZDiagram;
    if (!el || !D) return null;
    var state = { narrow: null, d: null };
    function paint(force) {
      if (!el.clientWidth && state.d) { state.dirty = true; return; }   /* hidden: redraw when shown */
      var narrow = el.clientWidth < 640;
      if (!force && !state.dirty && narrow === state.narrow) return;
      state.dirty = false;
      state.narrow = narrow;
      var d = build(D, { narrow: narrow });
      if (!d) return;
      d.fit(16);
      el.innerHTML = d.render();
      var svg = el.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', d.width);
        svg.style.maxWidth = d.width + 'px';
        svg.style.minWidth = Math.min(d.width, narrow ? 360 : 640) + 'px';
        svg.style.width = '100%';
      }
      state.d = d;
      if (d.warnings.length) {
        d.warnings.forEach(function (w) { console.error('[rz-diagram]', w.kind, w.message); });
      }
    }
    function act(e) {
      var t = e.target.closest ? e.target.closest('[data-rzd-hit]') : null;
      if (!t || !onSelect) return;
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      onSelect(t.getAttribute('data-rzd-hit'), t);
    }
    el.addEventListener('click', act);
    el.addEventListener('keydown', act);
    paint(true);
    /* The pane, not the window, decides the layout. A figure built inside a
     * hidden tab measures 0 wide and would stay in the narrow layout after
     * its tab opened; the inspector opening also narrows the pane. Observe
     * the canvas itself, and fall back to the window where unsupported. */
    var raf = 0;
    function later() { cancelAnimationFrame(raf); raf = requestAnimationFrame(function () { paint(false); }); }
    if (root.ResizeObserver) new root.ResizeObserver(function () { if (el.clientWidth) later(); }).observe(el);
    else root.addEventListener('resize', later);
    document.addEventListener('ltc:tab', later);
    return {
      redraw: function () { paint(true); },
      /** Set a state on one node's box without a redraw (selected/maint/fail/dead/live). */
      mark: function (id, st) {
        var r = el.querySelector('[data-rzd-node="' + id + '"]');
        if (!r) return;
        if (st) r.setAttribute('data-rzd-state', st); else r.removeAttribute('data-rzd-state');
      },
      get ctx() { return state.d; }
    };
  }

  /* ---- boot -------------------------------------------------------------- */
  function init(o) {
    o = o || {};
    applyTheme(initialTheme());
    renderRail(o.module);
    var mod = MODULES.filter(function (m) { return m.id === o.module; })[0];
    var crumb = $('#ltcCrumb');
    if (crumb && mod) crumb.textContent = 'LTC Workbench / ' + mod.code;
    var tb = $('#themeToggle');
    if (tb) tb.addEventListener('click', function () {
      applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
    document.addEventListener('keydown', function (e) {
      var app = $('.ltc-app');
      if (e.key === 'Escape' && app && app.getAttribute('data-insp') === 'open') closeInspector();
    });
    initTabs();
  }

  var API = {
    MODULES: MODULES, init: init, inspect: inspect, closeInspector: closeInspector,
    draw: draw, kv: kv, sym: sym, esc: esc, fmt: fmt, $: $, $$: $$
  };
  root.LTC = API;
})(window);
