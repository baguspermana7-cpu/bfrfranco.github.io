/**
 * rz-feature-flags.js — 3-Tier Feature Flag System for ResistanceZero
 * Version: v1.18.0 | 2026-05-14
 *
 * Canonical schema + runtime helper API.
 * Tiers: free | demo | pro
 *
 * Load BEFORE any page-level JS that calls _rzFeatures.has().
 * Depends on auth.js (_rzAuth.getTier) when available; falls back to
 * reading rz_premium_session from localStorage directly.
 *
 * Public API:
 *   window._rzFeatures.has(pageKey, featureKey) → boolean
 *   window._rzFeatures.getTier()                → 'free' | 'demo' | 'pro'
 *   window._rzFeatures.listFeatures(pageKey)    → string[]
 *   window._rzFeatures.listPages()              → string[]
 *
 * Admin override storage key: rz_admin_features_by_page (JSON object)
 * Structure: { [pageKey]: { [featureKey]: { free, demo, pro } } }
 * Dispatches CustomEvent 'rz-features-changed' when overrides change.
 */

/* ── Canonical schema ───────────────────────────────────────────────────── */
window.RZ_FEATURE_FLAGS = {

  /* ── Spares Readiness Calculator ─────────────────────────────────────── */
  'spares-readiness-calculator': {
    'advanced-tabs':           { free: true,  demo: true,  pro: true  },
    'pdf-export':              { free: false, demo: true,  pro: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true  },
    'manual-pdf':              { free: false, demo: false, pro: true  },
    'scenario-save':           { free: false, demo: true,  pro: true  },
    'scenario-load':           { free: false, demo: true,  pro: true  },
    'scenario-share-url':      { free: true,  demo: true,  pro: true  },
    'monte-carlo-1000':        { free: false, demo: true,  pro: true  },
    'monte-carlo-10000':       { free: false, demo: false, pro: true  },
    'meio-optimizer':          { free: false, demo: false, pro: true  },
    'operating-engine-gens':   { free: false, demo: true,  pro: true  },
    'parts-catalog':           { free: false, demo: true,  pro: true  },
    'parts-catalog-export':    { free: false, demo: false, pro: true  }
  },

  /* ── PUE Calculator ───────────────────────────────────────────────────── */
  'pue-calculator': {
    'advanced-mode':           { free: false, demo: true,  pro: true  },
    'pdf-export':              { free: false, demo: true,  pro: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true  },
    'unblur-cost':             { free: false, demo: true,  pro: true  },
    'unblur-energy':           { free: false, demo: true,  pro: true  },
    'scenario-save':           { free: false, demo: true,  pro: true  },
    'multi-scenario':          { free: false, demo: false, pro: true  },
    'economizer-inputs':       { free: false, demo: true,  pro: true  },
    'monte-carlo':             { free: false, demo: true,  pro: true  },
    'sensitivity-tornado':     { free: false, demo: true,  pro: true  },
    'pro-charts':              { free: false, demo: true,  pro: true  }
  },

  /* ── CAPEX Calculator ─────────────────────────────────────────────────── */
  'capex-calculator': {
    'advanced-mode':           { free: false, demo: true,  pro: true  },
    'pdf-export':              { free: false, demo: true,  pro: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true  },
    'unblur-cost':             { free: false, demo: true,  pro: true  },
    'unblur-energy':           { free: false, demo: true,  pro: true  },
    'scenario-save':           { free: false, demo: true,  pro: true  },
    'multi-scenario':          { free: false, demo: false, pro: true  },
    'per-kw-breakdown':        { free: false, demo: true,  pro: true  },
    'monte-carlo':             { free: false, demo: true,  pro: true  },
    'sensitivity-tornado':     { free: false, demo: true,  pro: true  },
    'pro-charts':              { free: false, demo: true,  pro: true  }
  },

  /* ── OPEX Calculator ──────────────────────────────────────────────────── */
  'opex-calculator': {
    'advanced-mode':           { free: false, demo: true,  pro: true  },
    'pdf-export':              { free: false, demo: true,  pro: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true  },
    'scenario-save':           { free: false, demo: true,  pro: true  },
    'multi-scenario':          { free: false, demo: false, pro: true  },
    'scenario-comparison':     { free: true,  demo: true,  pro: true  },
    'monte-carlo':             { free: false, demo: true,  pro: true  },
    'sensitivity-tornado':     { free: false, demo: true,  pro: true  },
    'pro-charts':              { free: false, demo: true,  pro: true  },
    'staffing-model':          { free: false, demo: true,  pro: true  }
  },

  /* ── ROI Calculator ───────────────────────────────────────────────────── */
  'roi-calculator': {
    'advanced-mode':           { free: false, demo: true,  pro: true  },
    'pdf-export':              { free: false, demo: true,  pro: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true  },
    'scenario-save':           { free: false, demo: true,  pro: true  },
    'multi-scenario':          { free: false, demo: false, pro: true  },
    'monte-carlo':             { free: false, demo: true,  pro: true  },
    'sensitivity-tornado':     { free: false, demo: true,  pro: true  },
    'cashflow-table':          { free: false, demo: true,  pro: true  },
    'pro-charts':              { free: false, demo: true,  pro: true  },
    'scenario-analysis':       { free: false, demo: true,  pro: true  }
  },

  /* ── TCO Calculator ───────────────────────────────────────────────────── */
  'tco-calculator': {
    'advanced-mode':           { free: false, demo: true,  pro: true  },
    'pdf-export':              { free: false, demo: true,  pro: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true  },
    'watermark-removed':       { free: false, demo: false, pro: true  },
    'scenario-save':           { free: false, demo: true,  pro: true  },
    'multi-scenario':          { free: false, demo: false, pro: true  },
    'colo-escalation-input':   { free: false, demo: true,  pro: true  },
    'cloud-discount-input':    { free: false, demo: true,  pro: true  },
    'debt-equity-input':       { free: false, demo: true,  pro: true  },
    'monte-carlo':             { free: false, demo: true,  pro: true  },
    'sensitivity-tornado':     { free: false, demo: true,  pro: true  },
    'pro-charts':              { free: false, demo: true,  pro: true  }
  },

  /* ── CX Calculator ────────────────────────────────────────────────────── */
  'cx-calculator': {
    'pro-panels':              { free: false, demo: true,  pro: true  },
    'pdf-export':              { free: false, demo: true,  pro: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true  },
    'scenario-save':           { free: false, demo: true,  pro: true  },
    'multi-scenario':          { free: false, demo: false, pro: true  },
    'advanced-tabs':           { free: false, demo: true,  pro: true  },
    'gate-pack-report':        { free: false, demo: false, pro: true  },
    'defect-aging-report':     { free: false, demo: false, pro: true  },
    'customer-witness-mode':   { free: false, demo: false, pro: true  },
    'forecast-engine':         { free: false, demo: true,  pro: true  },
    'snapshot-comparison':     { free: false, demo: false, pro: true  },
    'unlimited-projects':      { free: false, demo: false, pro: true  },
    'unlimited-defects':       { free: false, demo: false, pro: true  }
  },

  /* ── Carbon Footprint Calculator ─────────────────────────────────────── */
  'carbon-footprint': {
    'pro-mode':                { free: false, demo: true,  pro: true  },
    'pdf-export':              { free: false, demo: true,  pro: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true  },
    'scenario-save':           { free: false, demo: true,  pro: true  },
    'multi-scenario':          { free: false, demo: false, pro: true  },
    'monte-carlo':             { free: false, demo: true,  pro: true  },
    'sensitivity-tornado':     { free: false, demo: true,  pro: true  },
    'compliance-panel':        { free: false, demo: true,  pro: true  },
    'pro-charts':              { free: false, demo: true,  pro: true  }
  },

  /* ── TIA-942 Checklist ────────────────────────────────────────────────── */
  'tia-942-checklist': {
    'advanced-tier-4':         { free: false, demo: true,  pro: true  },
    'pdf-export':              { free: false, demo: true,  pro: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true  },
    'pro-analysis':            { free: false, demo: true,  pro: true  },
    'pro-charts':              { free: false, demo: true,  pro: true  },
    'gap-export':              { free: false, demo: false, pro: true  },
    'scenario-save':           { free: false, demo: true,  pro: true  },
    'regional-scoring':        { free: false, demo: true,  pro: true  }
  },

  /* ── Tier Advisor ─────────────────────────────────────────────────────── */
  'tier-advisor': {
    'pro-recommendations':     { free: false, demo: true,  pro: true  },
    'pdf-export':              { free: false, demo: true,  pro: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true  },
    'regional-scoring':        { free: false, demo: true,  pro: true  },
    'monte-carlo':             { free: false, demo: true,  pro: true  },
    'sensitivity-tornado':     { free: false, demo: true,  pro: true  },
    'pro-charts':              { free: false, demo: true,  pro: true  },
    'scenario-save':           { free: false, demo: true,  pro: true  }
  },

  /* ── RFS Readiness Workbench ──────────────────────────────────────────── */
  'rfs-readiness-workbench': {
    'pro-mode':                { free: false, demo: true,  pro: true  },
    'pdf-export':              { free: false, demo: true,  pro: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true  },
    'advanced-tabs':           { free: false, demo: true,  pro: true  },
    'gate-pack-report':        { free: false, demo: false, pro: true  },
    'defect-aging-report':     { free: false, demo: false, pro: true  },
    'forecast-snapshots':      { free: false, demo: true,  pro: true  },
    'snapshot-comparison':     { free: false, demo: false, pro: true  },
    'unlimited-units':         { free: false, demo: false, pro: true  },
    'unlimited-defects':       { free: false, demo: false, pro: true  },
    'scenario-save':           { free: false, demo: true,  pro: true  }
  },

  /* ── DC Market Tracker ────────────────────────────────────────────────── */
  'dc-market-tracker': {
    'advanced-analytics':      { free: false, demo: true,  pro: true  },
    'pdf-export':              { free: false, demo: true,  pro: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true  },
    'pro-panels':              { free: false, demo: true,  pro: true  },
    'watermark-removed':       { free: false, demo: false, pro: true  },
    'forecast-view':           { free: false, demo: true,  pro: true  },
    'scenario-save':           { free: false, demo: true,  pro: true  },
    'scenario-share-url':      { free: true,  demo: true,  pro: true  },
    'pro-charts':              { free: false, demo: true,  pro: true  }
  },

  /* ── DataHall AI ──────────────────────────────────────────────────────── */
  /* ── DatahallAI (BMS simulation, lowercase kebab canonical key) ───────── */
  'datahall-ai': {
    'pro-views':               { free: false, demo: false, pro: true  },
    'pdf-export':              { free: false, demo: false, pro: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true  },
    'advanced-analytics':      { free: false, demo: false, pro: true  },
    'full-dashboard':          { free: false, demo: false, pro: true  },
    'scenario-save':           { free: false, demo: false, pro: true  }
  },

  /* ── DC Conventional ──────────────────────────────────────────────────── */
  'dc-conventional': {
    'pro-views':               { free: false, demo: false, pro: true  },
    'pdf-export':              { free: false, demo: false, pro: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true  },
    'advanced-analytics':      { free: false, demo: false, pro: true  },
    'full-dashboard':          { free: false, demo: false, pro: true  },
    'scenario-save':           { free: false, demo: false, pro: true  }
  },

  /* ── v1.18.1 reconciliation: add 4 pages from Agent B's fallback set ──── */

  /* ── DCMOC (Next.js subapp at /dcmoc/) ─────────────────────────────────── */
  'dcmoc': {
    'advanced-mode':           { free: false, demo: true,  pro: true  },
    'pdf-export':              { free: false, demo: true,  pro: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true  },
    'scenario-save':           { free: false, demo: true,  pro: true  },
    'sensitivity-sliders':     { free: false, demo: false, pro: true  },
    'strategic-planning':      { free: false, demo: false, pro: true  },
    'scenario-comparison':     { free: false, demo: true,  pro: true  },
    'tooltips':                { free: true,  demo: true,  pro: true  }
  },

  /* ── Finance Terminal (admin subapp) ───────────────────────────────────── */
  'finance-terminal': {
    'advanced-mode':           { free: false, demo: true,  pro: true  },
    'pdf-export':              { free: false, demo: true,  pro: true  },
    'api-access':              { free: false, demo: false, pro: true  },
    'live-quotes':             { free: false, demo: true,  pro: true  },
    'portfolio-save':          { free: false, demo: false, pro: true  },
    'tooltips':                { free: true,  demo: true,  pro: true  }
  },

  /* ── PLN Java-Bali Grid (overview + 4 province sub-pages) ─────────────── */
  'pln-java-grid': {
    'sld-view':                { free: true,  demo: true,  pro: true  },
    'map-view':                { free: true,  demo: true,  pro: true  },
    'historical-data':         { free: false, demo: true,  pro: true  },
    'province-overlay':        { free: false, demo: true,  pro: true  },
    'pdf-export':              { free: false, demo: true,  pro: true  },
    'csv-export':              { free: false, demo: false, pro: true  },
    'tooltips':                { free: true,  demo: true,  pro: true  }
  },

  /* ── Tools hub (consolidated tool index page) ──────────────────────────── */
  'tools': {
    'advanced-mode':           { free: false, demo: true,  pro: true  },
    'pdf-export':              { free: false, demo: true,  pro: true  },
    'pro-tools-access':        { free: false, demo: false, pro: true  },
    'tooltips':                { free: true,  demo: true,  pro: true  }
  }

};

/* ── Runtime helper API ─────────────────────────────────────────────────── */
window._rzFeatures = (function () {
  'use strict';

  /**
   * Resolve the current user tier: 'free' | 'demo' | 'pro'.
   * Delegates to _rzAuth.getTier() when auth.js is loaded; otherwise reads
   * rz_premium_session directly so this module is self-contained.
   */
  function getTier() {
    if (window._rzAuth && typeof window._rzAuth.getTier === 'function') {
      return window._rzAuth.getTier();
    }
    try {
      var raw = localStorage.getItem('rz_premium_session');
      if (!raw) return 'free';
      var s = JSON.parse(raw);
      if (!s || !s.email) return 'free';
      var email = String(s.email).toLowerCase();
      if (email.indexOf('admin@') === 0 || email.indexOf('bagus@') === 0) return 'pro';
      if (email.indexOf('demo@') === 0) return 'demo';
      /* Any other authenticated session is treated as pro */
      return 'pro';
    } catch (e) {
      return 'free';
    }
  }

  /**
   * Check whether a feature is available for the current tier.
   * Respects per-page admin overrides stored in rz_admin_features_by_page.
   *
   * @param  {string} pageKey    — e.g. 'pue-calculator'
   * @param  {string} featureKey — e.g. 'pdf-export'
   * @returns {boolean}
   */
  function has(pageKey, featureKey) {
    var tier = getTier();

    /* Check admin overrides first */
    try {
      var overrides = JSON.parse(
        localStorage.getItem('rz_admin_features_by_page') || '{}'
      );
      if (overrides[pageKey] && overrides[pageKey][featureKey]) {
        var ov = overrides[pageKey][featureKey];
        if (typeof ov[tier] === 'boolean') {
          return ov[tier];
        }
      }
    } catch (e) { /* ignore malformed overrides */ }

    /* Fall back to canonical schema */
    var pageDef = window.RZ_FEATURE_FLAGS && window.RZ_FEATURE_FLAGS[pageKey];
    if (!pageDef) return false;
    var featDef = pageDef[featureKey];
    if (!featDef) return false;
    return !!featDef[tier];
  }

  /**
   * Return all feature keys defined for a given page.
   * @param  {string} pageKey
   * @returns {string[]}
   */
  function listFeatures(pageKey) {
    return Object.keys(
      (window.RZ_FEATURE_FLAGS && window.RZ_FEATURE_FLAGS[pageKey]) || {}
    );
  }

  /**
   * Return all page keys registered in the schema.
   * @returns {string[]}
   */
  function listPages() {
    return Object.keys(window.RZ_FEATURE_FLAGS || {});
  }

  return {
    getTier: getTier,
    has: has,
    listFeatures: listFeatures,
    listPages: listPages
  };
}());

/* ── Admin override hot-reload ─────────────────────────────────────────── */
window.addEventListener('storage', function (e) {
  if (e.key === 'rz_admin_features_by_page') {
    try {
      window.dispatchEvent(new CustomEvent('rz-features-changed'));
    } catch (_) { /* IE11 guard — no-op */ }
  }
});
