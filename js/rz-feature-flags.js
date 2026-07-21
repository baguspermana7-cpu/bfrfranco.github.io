/**
 * rz-feature-flags.js — 4-Tier Feature Flag System for ResistanceZero
 * Version: v1.18.0 | 2026-05-14
 *
 * Canonical schema + runtime helper API.
 * Tiers: free | demo | pro | root
 *
 * The `root` column was added by the educator-tier matrix migration. Every
 * page-feature object carries `root: <bool>` (default true — root keeps full
 * access). Educator users have tier === 'pro' (educator is a ROLE, not a
 * tier), so they consume the PRO column. Root users consume the ROOT column.
 *
 * Convention: a page-level "access" gate uses a feature called `page-access`
 * on the same page entry. The DC pages (datahall-ai, dc-conventional, dcmoc)
 * use this to convert the legacy ROOT_ONLY hard-block into a matrix-driven
 * gate that pro/educator users pass and demo/free users do not.
 *
 * Load BEFORE any page-level JS that calls _rzFeatures.has().
 * Depends on auth.js (_rzAuth.getTier) when available; falls back to
 * reading rz_premium_session from localStorage directly.
 *
 * Public API:
 *   window._rzFeatures.has(pageKey, featureKey) → boolean
 *   window._rzFeatures.getTier()                → 'free' | 'demo' | 'pro' | 'root'
 *   window._rzFeatures.listFeatures(pageKey)    → string[]
 *   window._rzFeatures.listPages()              → string[]
 *
 * Admin override storage key: rz_admin_features_by_page (JSON object)
 * Structure: { [pageKey]: { [featureKey]: { free, demo, pro, root } } }
 * Dispatches CustomEvent 'rz-features-changed' when overrides change.
 */

/* ── Canonical schema ───────────────────────────────────────────────────── */
window.RZ_FEATURE_FLAGS = {

  /* ── Spares Readiness Calculator ─────────────────────────────────────── */
  'spares-readiness-calculator': {
    'advanced-tabs':           { free: true,  demo: true,  pro: true, root: true  },
    'pdf-export':              { free: false, demo: true,  pro: true, root: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true, root: true  },
    'manual-pdf':              { free: false, demo: false, pro: true, root: true  },
    'scenario-save':           { free: false, demo: true,  pro: true, root: true  },
    'scenario-load':           { free: false, demo: true,  pro: true, root: true  },
    'scenario-share-url':      { free: true,  demo: true,  pro: true, root: true  },
    'monte-carlo-1000':        { free: false, demo: true,  pro: true, root: true  },
    'monte-carlo-10000':       { free: false, demo: false, pro: true, root: true  },
    'meio-optimizer':          { free: false, demo: false, pro: true, root: true  },
    'operating-engine-gens':   { free: false, demo: true,  pro: true, root: true  },
    'parts-catalog':           { free: false, demo: true,  pro: true, root: true  },
    'parts-catalog-export':    { free: false, demo: false, pro: true, root: true  }
  },

  /* ── PUE Calculator ───────────────────────────────────────────────────── */
  'pue-calculator': {
    'advanced-mode':           { free: false, demo: true,  pro: true, root: true  },
    'pdf-export':              { free: false, demo: true,  pro: true, root: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true, root: true  },
    'unblur-cost':             { free: false, demo: true,  pro: true, root: true  },
    'unblur-energy':           { free: false, demo: true,  pro: true, root: true  },
    'scenario-save':           { free: false, demo: true,  pro: true, root: true  },
    'multi-scenario':          { free: false, demo: false, pro: true, root: true  },
    'economizer-inputs':       { free: false, demo: true,  pro: true, root: true  },
    'monte-carlo':             { free: false, demo: true,  pro: true, root: true  },
    'sensitivity-tornado':     { free: false, demo: true,  pro: true, root: true  },
    'pro-charts':              { free: false, demo: true,  pro: true, root: true  }
  },

  /* ── CAPEX Calculator ─────────────────────────────────────────────────── */
  'capex-calculator': {
    'advanced-mode':           { free: false, demo: true,  pro: true, root: true  },
    'pdf-export':              { free: false, demo: true,  pro: true, root: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true, root: true  },
    'unblur-cost':             { free: false, demo: true,  pro: true, root: true  },
    'unblur-energy':           { free: false, demo: true,  pro: true, root: true  },
    'scenario-save':           { free: false, demo: true,  pro: true, root: true  },
    'multi-scenario':          { free: false, demo: false, pro: true, root: true  },
    'per-kw-breakdown':        { free: false, demo: true,  pro: true, root: true  },
    'monte-carlo':             { free: false, demo: true,  pro: true, root: true  },
    'sensitivity-tornado':     { free: false, demo: true,  pro: true, root: true  },
    'pro-charts':              { free: false, demo: true,  pro: true, root: true  }
  },

  /* ── OPEX Calculator ──────────────────────────────────────────────────── */
  'opex-calculator': {
    'advanced-mode':           { free: false, demo: true,  pro: true, root: true  },
    'pdf-export':              { free: false, demo: true,  pro: true, root: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true, root: true  },
    'scenario-save':           { free: false, demo: true,  pro: true, root: true  },
    'multi-scenario':          { free: false, demo: false, pro: true, root: true  },
    'scenario-comparison':     { free: true,  demo: true,  pro: true, root: true  },
    'monte-carlo':             { free: false, demo: true,  pro: true, root: true  },
    'sensitivity-tornado':     { free: false, demo: true,  pro: true, root: true  },
    'pro-charts':              { free: false, demo: true,  pro: true, root: true  },
    'staffing-model':          { free: false, demo: true,  pro: true, root: true  }
  },

  /* ── ROI Calculator ───────────────────────────────────────────────────── */
  'roi-calculator': {
    'advanced-mode':           { free: false, demo: true,  pro: true, root: true  },
    'pdf-export':              { free: false, demo: true,  pro: true, root: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true, root: true  },
    'scenario-save':           { free: false, demo: true,  pro: true, root: true  },
    'multi-scenario':          { free: false, demo: false, pro: true, root: true  },
    'monte-carlo':             { free: false, demo: true,  pro: true, root: true  },
    'sensitivity-tornado':     { free: false, demo: true,  pro: true, root: true  },
    'cashflow-table':          { free: false, demo: true,  pro: true, root: true  },
    'pro-charts':              { free: false, demo: true,  pro: true, root: true  },
    'scenario-analysis':       { free: false, demo: true,  pro: true, root: true  }
  },

  /* ── TCO Calculator ───────────────────────────────────────────────────── */
  'tco-calculator': {
    'advanced-mode':           { free: false, demo: true,  pro: true, root: true  },
    'pdf-export':              { free: false, demo: true,  pro: true, root: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true, root: true  },
    'watermark-removed':       { free: false, demo: false, pro: true, root: true  },
    'scenario-save':           { free: false, demo: true,  pro: true, root: true  },
    'multi-scenario':          { free: false, demo: false, pro: true, root: true  },
    'colo-escalation-input':   { free: false, demo: true,  pro: true, root: true  },
    'cloud-discount-input':    { free: false, demo: true,  pro: true, root: true  },
    'debt-equity-input':       { free: false, demo: true,  pro: true, root: true  },
    'monte-carlo':             { free: false, demo: true,  pro: true, root: true  },
    'sensitivity-tornado':     { free: false, demo: true,  pro: true, root: true  },
    'pro-charts':              { free: false, demo: true,  pro: true, root: true  }
  },

  /* ── CX Calculator ────────────────────────────────────────────────────── */
  'cx-calculator': {
    'pro-panels':              { free: false, demo: true,  pro: true, root: true  },
    'pdf-export':              { free: false, demo: true,  pro: true, root: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true, root: true  },
    'scenario-save':           { free: false, demo: true,  pro: true, root: true  },
    'multi-scenario':          { free: false, demo: false, pro: true, root: true  },
    'advanced-tabs':           { free: false, demo: true,  pro: true, root: true  },
    'gate-pack-report':        { free: false, demo: false, pro: true, root: true  },
    'defect-aging-report':     { free: false, demo: false, pro: true, root: true  },
    'customer-witness-mode':   { free: false, demo: false, pro: true, root: true  },
    'forecast-engine':         { free: false, demo: true,  pro: true, root: true  },
    'snapshot-comparison':     { free: false, demo: false, pro: true, root: true  },
    'unlimited-projects':      { free: false, demo: false, pro: true, root: true  },
    'unlimited-defects':       { free: false, demo: false, pro: true, root: true  }
  },

  /* ── Carbon Footprint Calculator ─────────────────────────────────────── */
  'carbon-footprint': {
    'pro-mode':                { free: false, demo: true,  pro: true, root: true  },
    'pdf-export':              { free: false, demo: true,  pro: true, root: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true, root: true  },
    'scenario-save':           { free: false, demo: true,  pro: true, root: true  },
    'multi-scenario':          { free: false, demo: false, pro: true, root: true  },
    'monte-carlo':             { free: false, demo: true,  pro: true, root: true  },
    'sensitivity-tornado':     { free: false, demo: true,  pro: true, root: true  },
    'compliance-panel':        { free: false, demo: true,  pro: true, root: true  },
    'pro-charts':              { free: false, demo: true,  pro: true, root: true  }
  },

  /* ── TIA-942 Checklist ────────────────────────────────────────────────── */
  'tia-942-checklist': {
    'advanced-tier-4':         { free: false, demo: true,  pro: true, root: true  },
    'pdf-export':              { free: false, demo: true,  pro: true, root: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true, root: true  },
    'pro-analysis':            { free: false, demo: true,  pro: true, root: true  },
    'pro-charts':              { free: false, demo: true,  pro: true, root: true  },
    'gap-export':              { free: false, demo: false, pro: true, root: true  },
    'scenario-save':           { free: false, demo: true,  pro: true, root: true  },
    'regional-scoring':        { free: false, demo: true,  pro: true, root: true  }
  },

  /* ── Tier Advisor ─────────────────────────────────────────────────────── */
  'tier-advisor': {
    'pro-recommendations':     { free: false, demo: true,  pro: true, root: true  },
    'pdf-export':              { free: false, demo: true,  pro: true, root: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true, root: true  },
    'regional-scoring':        { free: false, demo: true,  pro: true, root: true  },
    'monte-carlo':             { free: false, demo: true,  pro: true, root: true  },
    'sensitivity-tornado':     { free: false, demo: true,  pro: true, root: true  },
    'pro-charts':              { free: false, demo: true,  pro: true, root: true  },
    'scenario-save':           { free: false, demo: true,  pro: true, root: true  }
  },

  /* ── RFS Readiness Workbench ──────────────────────────────────────────── */
  'rfs-readiness-workbench': {
    'pro-mode':                { free: false, demo: true,  pro: true, root: true  },
    'pdf-export':              { free: false, demo: true,  pro: true, root: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true, root: true  },
    'advanced-tabs':           { free: false, demo: true,  pro: true, root: true  },
    'gate-pack-report':        { free: false, demo: false, pro: true, root: true  },
    'defect-aging-report':     { free: false, demo: false, pro: true, root: true  },
    'forecast-snapshots':      { free: false, demo: true,  pro: true, root: true  },
    'snapshot-comparison':     { free: false, demo: false, pro: true, root: true  },
    'unlimited-units':         { free: false, demo: false, pro: true, root: true  },
    'unlimited-defects':       { free: false, demo: false, pro: true, root: true  },
    'scenario-save':           { free: false, demo: true,  pro: true, root: true  }
  },

  /* ── DC Market Tracker ────────────────────────────────────────────────── */
  'dc-market-tracker': {
    'advanced-analytics':      { free: false, demo: true,  pro: true, root: true  },
    'pdf-export':              { free: false, demo: true,  pro: true, root: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true, root: true  },
    'pro-panels':              { free: false, demo: true,  pro: true, root: true  },
    'watermark-removed':       { free: false, demo: false, pro: true, root: true  },
    'forecast-view':           { free: false, demo: true,  pro: true, root: true  },
    'scenario-save':           { free: false, demo: true,  pro: true, root: true  },
    'scenario-share-url':      { free: true,  demo: true,  pro: true, root: true  },
    'pro-charts':              { free: false, demo: true,  pro: true, root: true  }
  },

  /* ── DataHall AI ──────────────────────────────────────────────────────── */
  /* ── DatahallAI (BMS simulation, lowercase kebab canonical key) ─────────
     `page-access` is the page-level access gate (see file header). Educator
     users (role=educator, tier=pro) and pro users pass; demo and free do
     not. Root always passes. Replaces the legacy ROOT_ONLY_PATHS hard block. */
  'datahall-ai': {
    'page-access':             { free: false, demo: false, pro: true, root: true  },
    'pro-views':               { free: false, demo: false, pro: true, root: true  },
    'pdf-export':              { free: false, demo: false, pro: true, root: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true, root: true  },
    'advanced-analytics':      { free: false, demo: false, pro: true, root: true  },
    'full-dashboard':          { free: false, demo: false, pro: true, root: true  },
    'scenario-save':           { free: false, demo: false, pro: true, root: true  }
  },

  /* ── Second Brain + Vector Index dashboard (ROOT-ONLY: bagus@/admin@) ────── */
  'second-brain': {
    'page-access':             { free: false, demo: false, pro: false, root: true }
  },
  'vector-index': {
    'page-access':             { free: false, demo: false, pro: false, root: true }
  },

  /* ── DC Conventional ──────────────────────────────────────────────────── */
  'dc-conventional': {
    'page-access':             { free: false, demo: false, pro: true, root: true  },
    'pro-views':               { free: false, demo: false, pro: true, root: true  },
    'pdf-export':              { free: false, demo: false, pro: true, root: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true, root: true  },
    'advanced-analytics':      { free: false, demo: false, pro: true, root: true  },
    'full-dashboard':          { free: false, demo: false, pro: true, root: true  },
    'scenario-save':           { free: false, demo: false, pro: true, root: true  }
  },

  /* ── v1.18.1 reconciliation: add 4 pages from Agent B's fallback set ──── */

  /* ── DCMOC (Next.js subapp at /dcmoc/) ─────────────────────────────────── */
  'dcmoc': {
    /* DCMOC is ROOT-ONLY: the DCMOC Next.js app enforces root (dcmoc/src/store/auth.ts →
       ROOT_EMAILS) and auth.js nav-locks /dcmoc via ROOT_ONLY_PATHS. page-access matches. */
    'page-access':             { free: false, demo: false, pro: false, root: true  },
    'advanced-mode':           { free: false, demo: true,  pro: true, root: true  },
    'pdf-export':              { free: false, demo: true,  pro: true, root: true  },
    'pdf-watermark-removed':   { free: false, demo: false, pro: true, root: true  },
    'scenario-save':           { free: false, demo: true,  pro: true, root: true  },
    'sensitivity-sliders':     { free: false, demo: false, pro: true, root: true  },
    'strategic-planning':      { free: false, demo: false, pro: true, root: true  },
    'scenario-comparison':     { free: false, demo: true,  pro: true, root: true  },
    'tooltips':                { free: true,  demo: true,  pro: true, root: true  }
  },

  /* ── Finance Terminal (admin subapp) ───────────────────────────────────── */
  'finance-terminal': {
    'advanced-mode':           { free: false, demo: true,  pro: true, root: true  },
    'pdf-export':              { free: false, demo: true,  pro: true, root: true  },
    'api-access':              { free: false, demo: false, pro: true, root: true  },
    'live-quotes':             { free: false, demo: true,  pro: true, root: true  },
    'portfolio-save':          { free: false, demo: false, pro: true, root: true  },
    'tooltips':                { free: true,  demo: true,  pro: true, root: true  }
  },

  /* ── PLN Java-Bali Grid (overview + 4 province sub-pages) ─────────────── */
  'pln-java-grid': {
    'sld-view':                { free: true,  demo: true,  pro: true, root: true  },
    'map-view':                { free: true,  demo: true,  pro: true, root: true  },
    'historical-data':         { free: false, demo: true,  pro: true, root: true  },
    'province-overlay':        { free: false, demo: true,  pro: true, root: true  },
    'pdf-export':              { free: false, demo: true,  pro: true, root: true  },
    'csv-export':              { free: false, demo: false, pro: true, root: true  },
    'tooltips':                { free: true,  demo: true,  pro: true, root: true  }
  },

  /* ── Tools hub (consolidated tool index page) ──────────────────────────── */
  'tools': {
    'advanced-mode':           { free: false, demo: true,  pro: true, root: true  },
    'pdf-export':              { free: false, demo: true,  pro: true, root: true  },
    'pro-tools-access':        { free: false, demo: false, pro: true, root: true  },
    'tooltips':                { free: true,  demo: true,  pro: true, root: true  }
  },

  /* ─────────────────────────────────────────────────────────────────────────
     Task 3-bis (educator-tier expansion). The 8 entries below extend the
     matrix-driven page-access gate to the remaining LTC modules + the
     standards-ltc-lab hub. `page-access` defaults are identical: pro +
     educator (consumes pro) + root pass; free + demo see the upgrade modal.
     `datacenter-solutions` is a free-tier HUB page — the page-access entry
     here is only consulted by the standards-ltc-lab card click handler, NOT
     to gate the page itself (the page stays public).
     ──────────────────────────────────────────────────────────────────────── */

  'datacenter-solutions': {
    /* HUB page stays public — entry exists for completeness only. */
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },

  'standards-ltc-lab': {
    'page-access':             { free: false, demo: false, pro: true, root: true  }
  },

  'ltc-system-modelling-lab': {
    'page-access':             { free: false, demo: false, pro: true, root: true  }
  },

  'ltc-ashrae': {
    'page-access':             { free: false, demo: false, pro: true, root: true  }
  },

  'ltc-uptime': {
    'page-access':             { free: false, demo: false, pro: true, root: true  }
  },

  'ltc-ansi-tia': {
    'page-access':             { free: false, demo: false, pro: true, root: true  }
  },

  'ltc-iso-energy': {
    'page-access':             { free: false, demo: false, pro: true, root: true  }
  },

  'ltc-nfpa': {
    'page-access':             { free: false, demo: false, pro: true, root: true  }
  },

  /* ── AI Engineering Maintenance (concept brief — Lin & Ompusunggu 2026) ── */
  'ai-engineering-maintenance': {
    'page-access':             { free: false, demo: false, pro: true, root: true  }
  },

  /* ── Network Visualization Hub topics (Phase 0+; public tier) ── */
  'network-visualization-hub': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-modbus-rtu': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-modbus-tcp': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-bacnet-ip': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-opc-ua': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-compare': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-dnp3': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-profinet': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-ethernet-ip': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-ethercat': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-bacnet-mstp': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-osi-tcp-ip-models': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-ipv4-vs-ipv6': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-subnetting-cidr': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-tcp-handshake': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-dhcp-dns': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-tls-handshake': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-oauth-jwt': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-mtls': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-wireguard': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-rest-api': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-graphql': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-grpc': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-mcp-tool-call': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-snmp': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-ipmi-redfish': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  },
  'network-syslog': {
    'page-access':             { free: true,  demo: true,  pro: true, root: true  }
  }

};

/* ── Runtime helper API ─────────────────────────────────────────────────── */
window._rzFeatures = (function () {
  'use strict';

  /**
   * Resolve the current user tier: 'free' | 'demo' | 'pro' | 'root'.
   *
   * Delegates to _rzAuth.getTier() when auth.js is loaded; _rzAuth itself
   * already returns the right tier for root/demo/educator (educator → pro).
   * Root users are detected via _rzAuth.getRoleFromSession or by checking
   * the session role directly when auth.js is unavailable.
   *
   * Falls back to reading rz_premium_session from localStorage so this
   * module is self-contained.
   */
  function getTier() {
    /* Prefer auth.js when present so role detection stays in one place. */
    if (window._rzAuth) {
      try {
        var session = (typeof window._rzAuth.getSession === 'function')
          ? window._rzAuth.getSession()
          : null;
        var role = (typeof window._rzAuth.getRoleFromSession === 'function')
          ? window._rzAuth.getRoleFromSession(session)
          : (session && session.role) || '';
        if (role === 'root') return 'root';
      } catch (e) { /* fall through to getTier() */ }
      if (typeof window._rzAuth.getTier === 'function') {
        return window._rzAuth.getTier();
      }
    }
    try {
      var raw = localStorage.getItem('rz_premium_session');
      if (!raw) return 'free';
      var s = JSON.parse(raw);
      if (!s || !s.email) return 'free';
      if (s.role === 'root') return 'root';
      var email = String(s.email).toLowerCase();
      if (email.indexOf('admin@') === 0 || email.indexOf('bagus@') === 0) return 'root';
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
   * 4-tier resolution: free | demo | pro | root.
   * Back-compat: when a page-feature record lacks a `root` field (legacy
   * data still cached locally), treat root as allowed (true) — root keeps
   * full access by default.
   *
   * @param  {string} pageKey    — e.g. 'pue-calculator'
   * @param  {string} featureKey — e.g. 'pdf-export'
   * @returns {boolean}
   */
  function has(pageKey, featureKey) {
    var tier = getTier();

    /* Root inviolable invariant for page-level access:
       page-access for root is non-overridable. Admin overrides may
       still narrow root for individual feature flags (e.g. an admin
       might disable a beta feature for root testing), but they MUST
       NOT lock root out of a page entirely. This prevents accidental
       lockout from the admin panel writing root:false into the
       page-access override. */
    if (tier === 'root' && featureKey === 'page-access') return true;

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
        /* Back-compat: override missing root column but tier is root → allow. */
        if (tier === 'root') return true;
      }
    } catch (e) { /* ignore malformed overrides */ }

    /* Fall back to canonical schema */
    var pageDef = window.RZ_FEATURE_FLAGS && window.RZ_FEATURE_FLAGS[pageKey];
    if (!pageDef) return false;
    var featDef = pageDef[featureKey];
    if (!featDef) return false;
    if (tier === 'root' && typeof featDef.root === 'undefined') return true;
    return !!featDef[tier];
  }

  /**
   * Alias for has(pageKey, featureKey). The educator-tier migration
   * standardised on `canAccess` as the resolver name in plan + tests; both
   * names route through the same logic.
   * @param  {string} pageKey
   * @param  {string} featureKey
   * @returns {boolean}
   */
  function canAccess(pageKey, featureKey) {
    return has(pageKey, featureKey);
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
    canAccess: canAccess,
    listFeatures: listFeatures,
    listPages: listPages
  };
}());

/* Public mirror so callers can use either `window.RZ_FEATURE_FLAGS.canAccess`
   (the plan's preferred surface) or `window._rzFeatures.has` interchangeably. */
if (window.RZ_FEATURE_FLAGS && !window.RZ_FEATURE_FLAGS.canAccess) {
  window.RZ_FEATURE_FLAGS.canAccess = function (pageKey, featureKey) {
    return window._rzFeatures.canAccess(pageKey, featureKey);
  };
}

/* ── Admin override hot-reload ─────────────────────────────────────────── */
window.addEventListener('storage', function (e) {
  if (e.key === 'rz_admin_features_by_page') {
    try {
      window.dispatchEvent(new CustomEvent('rz-features-changed'));
    } catch (_) { /* IE11 guard — no-op */ }
  }
});
