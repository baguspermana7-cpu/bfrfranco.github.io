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
    'simulated':  { label: 'Simulated',   chip: 'SIM',        color: '#67e8f9', bg: 'rgba(6,182,212,0.12)', bd: 'rgba(6,182,212,0.42)' },
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
      /* PRD-Q06 FR-3 (v1.44.0): a still, in-flow text line. No fill, pill, shadow, dot, pulse or transition;
         state colour only on the label (comms_lost). The fixed variant stays for legacy adopters (none after FR-4)
         and keeps a surface so it stays legible over content. */
      '.rz-tq-banner{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 0 0 12px;background:transparent;' +
        'border:0;border-bottom:1px solid var(--rz-line-tier-2,rgba(255,255,255,.12));border-radius:0;box-sizing:border-box;' +
        'font:400 12px/1.4 var(--rz-font-mono,\'JetBrains Mono\',monospace);letter-spacing:.02em;' +
        'color:var(--rz-text-secondary,#A0AEC0)}' +
      '.rz-tq-banner-label{font-weight:600;color:var(--rz-text-primary,#E8EDF5)}' +
      '.rz-tq-banner[data-rz-tq-state="comms_lost"] .rz-tq-banner-label{color:var(--rz-accent-alert,#FF3030)}' +
      '[data-theme="light"] .rz-tq-banner{color:#374151;border-bottom-color:rgba(17,24,39,.14)}' +
      '[data-theme="light"] .rz-tq-banner-label{color:#111827}' +
      '[data-theme="light"] .rz-tq-banner[data-rz-tq-state="comms_lost"] .rz-tq-banner-label{color:#CC1F1F}' +
      '.rz-tq-banner:not(.rz-tq-banner--in-flow){position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:9998;' +
        'padding-right:0;background:var(--rz-bg-elevated,#121316);pointer-events:none}' +
      '[data-theme="light"] .rz-tq-banner:not(.rz-tq-banner--in-flow){background:#FFFFFF}' +
      '.rz-tq-banner.dismissed{display:none}' +
      '.rz-tq-banner--in-flow{position:static;width:100%;max-width:none}' +
      '.rz-tq-banner--compact{width:auto;max-width:280px;min-width:0;height:44px;padding:0 0 0 9px;' +
        'justify-content:flex-start;white-space:nowrap;flex:0 1 auto}' +
      '.rz-tq-banner--compact .rz-tq-banner-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.rz-tq-banner-close{background:transparent;border:none;color:inherit;cursor:pointer;' +
        'font-size:14px;line-height:1;padding:0;opacity:.65;pointer-events:auto;min-width:44px;' +
        'min-height:44px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 44px}' +
      '.rz-tq-banner-close:hover{opacity:1}' +
      '.rz-tq-banner-close:focus-visible{outline:2px solid var(--rz-accent-signal,#FFAA00);outline-offset:2px}' +
      '.rz-tq-chip{display:inline-block;padding:1px 6px;border-radius:3px;' +
        'font-family:JetBrains Mono,monospace;font-size:9px;font-weight:700;' +
        'letter-spacing:.05em;text-transform:uppercase;line-height:1.4;' +
        'vertical-align:baseline;margin-left:6px}' +
      '@media(max-width:768px){.rz-tq-banner:not(.rz-tq-banner--in-flow){max-width:calc(100vw - 16px);white-space:normal}}';
    (doc.head || doc.documentElement).appendChild(st);
  }

  var pageMode = null;
  var bannerEl = null;

  function authorityUnavailable() {
    if (!doc.body) { return false; }
    return doc.body.getAttribute('data-rz-basis-authority') === 'unavailable' ||
      doc.body.getAttribute('data-datahall-authority') === 'unavailable';
  }

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
    var effectiveMode = authorityUnavailable() ? 'comms_lost' : pageMode;
    /* Skip the banner for 'live' mode — operators don't need a label when
     * everything is genuine telemetry. Only surface non-live modes. */
    if (effectiveMode === 'live') {
      if (bannerEl) { bannerEl.remove(); bannerEl = null; }
      return;
    }
    var st = getState(effectiveMode);
    var slot = doc.querySelector('[data-rz-telemetry-banner-slot]');
    if (!bannerEl) {
      bannerEl = doc.createElement('div');
      bannerEl.className = 'rz-tq-banner';
      bannerEl.setAttribute('role', 'status');
      bannerEl.setAttribute('data-rz-tq-banner', '1');
    }
    var compact = !!(slot && slot.hasAttribute('data-rz-telemetry-compact'));
    if (slot) { bannerEl.classList.add('rz-tq-banner--in-flow'); }
    else { bannerEl.classList.remove('rz-tq-banner--in-flow'); }
    bannerEl.classList.toggle('rz-tq-banner--compact', compact);
    if (bannerEl.parentElement !== (slot || doc.body)) { (slot || doc.body).appendChild(bannerEl); }
    bannerEl.style.cssText = '';
    bannerEl.setAttribute('data-rz-tq-state', effectiveMode);
    var customLabel = slot && slot.getAttribute('data-rz-telemetry-label');
    var label = effectiveMode === 'comms_lost' ? 'COMMS LOST — AUTHORITY UNAVAILABLE' :
                customLabel ? customLabel : effectiveMode === 'simulated' ? 'Simulated telemetry — engine-derived basis' :
                effectiveMode === 'demo'      ? 'Demo mode — training values only' :
                                                st.label + ' — ' + esc(effectiveMode);
    bannerEl.title = effectiveMode === 'comms_lost'
      ? 'Governed engineering authority did not validate. Telemetry and controls are unavailable.'
      : effectiveMode === 'simulated'
      ? 'Simulated values from the engine model. They are not measured at a site.'
      : label;
    bannerEl.innerHTML =
      '<span class="rz-tq-banner-label">' + esc(label) + '</span>' +
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
    if (authorityUnavailable()) { return 'comms_lost'; }
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
      if (root && root.MutationObserver) {
        var observer = new root.MutationObserver(function () { renderBanner(); });
        observer.observe(doc.body, {
          attributes: true,
          attributeFilter: ['data-rz-basis-authority', 'data-datahall-authority', 'data-rz-data-mode']
        });
      }
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
    version: '1.44.0'
  };
  if (root) { root.RZTelemetryQuality = API; }

})(typeof window !== 'undefined' ? window : null,
   typeof document !== 'undefined' ? document : null);
