/* ============================================================================
 * rz-telemetry-quality.js — data-quality service (v1.43.2)
 * ----------------------------------------------------------------------------
 * Closes review doc-27 §3.4 ("simulation mode banner") + §5.7 P1 (BMS/DCIM
 * data quality discipline) + doc-28 Global UIUX Corrections:
 *
 *   "Setiap point penting punya data quality: live / stale / simulated /
 *    manual override / comms lost."
 *   "Tambahkan 'simulation mode' banner jika angka bukan live."
 *
 * The library provides:
 *   - 6 STATES enum with colours + labels
 *   - Page-level data-mode banner (top of viewport, dismissable)
 *   - Per-element `data-quality-state="..."` attribute reader / writer
 *   - audit() walker (consumed by probe-line-model.mjs)
 *   - getPointState() — used by RZInspector to render the Data Quality row
 *
 * Auto-attaches on DOMContentLoaded if `<body data-rz-data-mode="...">` is set.
 *
 * Zero-build, ES5-safe, no imports. Additive — pages without the body attribute
 * see no UI change.
 * ==========================================================================*/
(function (root, doc) {
  'use strict';
  if (!doc) { return; }

  /* ------------------------------------------------------------------ */
  /* States                                                              */
  /* ------------------------------------------------------------------ */
  var STATES = {
    'live':       { label: 'Live',        chip: 'LIVE',       color: '#86efac', bg: 'rgba(34,197,94,0.16)',  bd: 'rgba(34,197,94,0.45)' },
    'simulated':  { label: 'Simulated',   chip: 'SIM',        color: '#c4b5fd', bg: 'rgba(167,139,250,0.16)', bd: 'rgba(167,139,250,0.45)' },
    'stale':      { label: 'Stale',       chip: 'STALE',      color: '#fbbf24', bg: 'rgba(245,158,11,0.16)',  bd: 'rgba(245,158,11,0.45)' },
    'manual':     { label: 'Manual',      chip: 'MANUAL',     color: '#7dd3fc', bg: 'rgba(56,189,248,0.16)',  bd: 'rgba(56,189,248,0.45)' },
    'comms_lost': { label: 'Comms lost',  chip: 'NO COMMS',   color: '#fca5a5', bg: 'rgba(239,68,68,0.16)',   bd: 'rgba(239,68,68,0.55)' },
    'inhibited':  { label: 'Inhibited',   chip: 'INHIBITED',  color: '#94a3b8', bg: 'rgba(148,163,184,0.16)', bd: 'rgba(148,163,184,0.45)' },
    'demo':       { label: 'Demo / training', chip: 'DEMO',   color: '#fde047', bg: 'rgba(250,204,21,0.16)',  bd: 'rgba(250,204,21,0.45)' }
  };

  function getState(name) {
    if (!name || !STATES[name]) { return STATES['live']; }
    return STATES[name];
  }

  function esc(s) {
    if (s === null || s === undefined) { return ''; }
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ------------------------------------------------------------------ */
  /* Page-level banner                                                   */
  /* ------------------------------------------------------------------ */
  var STYLE_ID = 'rz-tq-styles';
  function injectStyles() {
    if (doc.getElementById(STYLE_ID)) { return; }
    var st = doc.createElement('style');
    st.id = STYLE_ID;
    st.textContent = '' +
      '.rz-tq-banner{position:fixed;top:0;left:50%;transform:translateX(-50%);' +
        'z-index:9998;padding:5px 14px 5px 12px;border-radius:0 0 8px 8px;' +
        'font-family:JetBrains Mono,monospace;font-size:10.5px;font-weight:600;' +
        'letter-spacing:.08em;text-transform:uppercase;display:flex;align-items:center;gap:8px;' +
        'box-shadow:0 4px 12px rgba(0,0,0,0.32);transition:transform .2s,opacity .2s;' +
        'pointer-events:none}' +
      '.rz-tq-banner.dismissed{transform:translateX(-50%) translateY(-110%);opacity:0;pointer-events:none}' +
      '.rz-tq-banner--in-flow{position:static;top:auto;left:auto;transform:none;width:100%;max-width:none;' +
        'box-sizing:border-box;justify-content:center;border-radius:0;box-shadow:none}' +
      '.rz-tq-banner--in-flow.dismissed{display:none;transform:none}' +
      '[data-theme="light"] .rz-tq-banner[data-rz-tq-state="live"]{color:#0B5D31!important;background:#E6F7ED!important;border-color:#167A45!important}' +
      '[data-theme="light"] .rz-tq-banner[data-rz-tq-state="simulated"]{color:#3F1D8F!important;background:#F0ECFF!important;border-color:#6B4DB8!important}' +
      '[data-theme="light"] .rz-tq-banner[data-rz-tq-state="stale"]{color:#6B4500!important;background:#FFF4D6!important;border-color:#946400!important}' +
      '[data-theme="light"] .rz-tq-banner[data-rz-tq-state="manual"]{color:#07546A!important;background:#E3F8FC!important;border-color:#087D9A!important}' +
      '[data-theme="light"] .rz-tq-banner[data-rz-tq-state="comms_lost"]{color:#8B1515!important;background:#FFEAEA!important;border-color:#B52222!important}' +
      '[data-theme="light"] .rz-tq-banner[data-rz-tq-state="inhibited"]{color:#344254!important;background:#EEF2F6!important;border-color:#5A6C80!important}' +
      '[data-theme="light"] .rz-tq-banner[data-rz-tq-state="demo"]{color:#684F00!important;background:#FFF8D6!important;border-color:#8B6A00!important}' +
      '.rz-tq-banner-dot{width:8px;height:8px;border-radius:50%;background:currentColor;' +
        'animation:rzTqPulse 1.8s ease-in-out infinite}' +
      '@keyframes rzTqPulse{0%,100%{opacity:.45}50%{opacity:1}}' +
      '.rz-tq-banner-close{background:transparent;border:none;color:inherit;cursor:pointer;' +
        'font-size:14px;line-height:1;padding:0;opacity:.65;pointer-events:auto;min-width:44px;' +
        'min-height:44px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 44px}' +
      '.rz-tq-banner-close:hover{opacity:1}' +
      '.rz-tq-banner-close:focus-visible{outline:2px solid var(--rz-accent-signal,#FFAA00);outline-offset:2px}' +
      '.rz-tq-chip{display:inline-block;padding:1px 6px;border-radius:3px;' +
        'font-family:JetBrains Mono,monospace;font-size:9px;font-weight:700;' +
        'letter-spacing:.05em;text-transform:uppercase;line-height:1.4;' +
        'vertical-align:baseline;margin-left:6px}' +
      '@media(prefers-reduced-motion:reduce){.rz-tq-banner-dot{animation:none}.rz-tq-banner{transition:none}}' +
      '@media(max-width:768px){.rz-tq-banner:not(.rz-tq-banner--in-flow){top:0;bottom:auto;max-width:calc(100vw - 16px);' +
        'border-radius:0 0 4px 4px;white-space:normal}.rz-tq-banner:not(.rz-tq-banner--in-flow).dismissed{' +
        'transform:translateX(-50%) translateY(-110%)}}';
    (doc.head || doc.documentElement).appendChild(st);
  }

  var pageMode = null;
  var bannerEl = null;

  function setPageMode(mode) {
    pageMode = mode;
    if (!doc.body) { return; }
    doc.body.setAttribute('data-rz-data-mode', mode);
    renderBanner();
  }

  function renderBanner() {
    if (!doc.body) { return; }
    if (!pageMode) {
      var existing = doc.querySelector('.rz-tq-banner');
      if (existing) { existing.remove(); }
      bannerEl = null;
      return;
    }
    /* Skip the banner for 'live' mode — operators don't need a label when
     * everything is genuine telemetry. Only surface non-live modes. */
    if (pageMode === 'live') {
      if (bannerEl) { bannerEl.remove(); bannerEl = null; }
      return;
    }
    var st = getState(pageMode);
    var slot = doc.querySelector('[data-rz-telemetry-banner-slot]');
    if (!bannerEl) {
      bannerEl = doc.createElement('div');
      bannerEl.className = 'rz-tq-banner';
      bannerEl.setAttribute('role', 'status');
      bannerEl.setAttribute('data-rz-tq-banner', '1');
    }
    if (slot) { bannerEl.classList.add('rz-tq-banner--in-flow'); }
    else { bannerEl.classList.remove('rz-tq-banner--in-flow'); }
    if (bannerEl.parentElement !== (slot || doc.body)) { (slot || doc.body).appendChild(bannerEl); }
    bannerEl.style.cssText = 'background:' + st.bg + ';color:' + st.color +
                             ';border:1px solid ' + st.bd + ';border-top:0';
    bannerEl.setAttribute('data-rz-tq-state', pageMode);
    var label = pageMode === 'simulated' ? 'Simulated telemetry — engine-derived basis' :
                pageMode === 'demo'      ? 'Demo mode — training values only' :
                                            st.label + ' — ' + esc(pageMode);
    bannerEl.innerHTML =
      '<span class="rz-tq-banner-dot"></span>' +
      '<span>' + esc(label) + '</span>' +
      '<button class="rz-tq-banner-close" aria-label="Dismiss banner" type="button">×</button>';
    var closeBtn = bannerEl.querySelector('.rz-tq-banner-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        bannerEl.classList.add('dismissed');
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Per-element quality                                                 */
  /* ------------------------------------------------------------------ */
  function markPoint(el, state) {
    if (!el || !el.setAttribute) { return; }
    if (!STATES[state]) { return; }
    el.setAttribute('data-quality-state', state);
  }

  function getPointState(el) {
    if (!el || !el.getAttribute) { return 'live'; }
    var explicit = el.getAttribute('data-quality-state');
    if (explicit && STATES[explicit]) { return explicit; }
    /* Inherit from page mode if no explicit attribute. */
    if (pageMode && STATES[pageMode]) { return pageMode; }
    return 'live';
  }

  function chipHtml(state) {
    var st = getState(state);
    return '<span class="rz-tq-chip" style="background:' + st.bg + ';color:' + st.color +
           ';border:1px solid ' + st.bd + '">' + esc(st.chip) + '</span>';
  }

  /* ------------------------------------------------------------------ */
  /* Auditor — consumed by tools/probe-line-model.mjs                   */
  /* ------------------------------------------------------------------ */
  function audit(rootEl) {
    var doc2 = rootEl || doc;
    if (!doc2) { return { mode: null, points: 0, issues: [{ kind: 'no-document' }] }; }
    var body = doc2.body || doc2.querySelector('body');
    var mode = (body && body.getAttribute('data-rz-data-mode')) || null;
    var points = doc2.querySelectorAll('[data-quality-state]');
    var issues = [];
    if (mode && !STATES[mode]) {
      issues.push({ kind: 'unknown-mode', mode: mode });
    }
    for (var i = 0; i < points.length; i++) {
      var st = points[i].getAttribute('data-quality-state');
      if (st && !STATES[st]) {
        issues.push({ kind: 'unknown-state', state: st, idx: i });
      }
    }
    return {
      mode: mode,
      bannerVisible: !!(doc2.querySelector('[data-rz-tq-banner]')),
      points: points.length,
      issues: issues
    };
  }

  /* ------------------------------------------------------------------ */
  /* Auto-init                                                           */
  /* ------------------------------------------------------------------ */
  function init() {
    injectStyles();
    if (doc.body) {
      var bodyMode = doc.body.getAttribute('data-rz-data-mode');
      if (bodyMode) { setPageMode(bodyMode); }
    }
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ------------------------------------------------------------------ */
  /* Export                                                              */
  /* ------------------------------------------------------------------ */
  var API = {
    STATES: STATES,
    setPageMode: setPageMode,
    markPoint: markPoint,
    getPointState: getPointState,
    chipHtml: chipHtml,
    audit: audit,
    version: '1.43.2'
  };
  if (root) { root.RZTelemetryQuality = API; }

})(typeof window !== 'undefined' ? window : null,
   typeof document !== 'undefined' ? document : null);
