# ResistanceZero Feature Flag System — Standardization Guide

> **Version**: 1.0 | **Introduced**: v1.18.0 | **Date**: 2026-05-14 | **Status**: Active
>
> **Depends on**: `js/rz-feature-flags.js` (schema + runtime helper), `auth.js` (session/tier)
>
> **See also**: `AUTH_STANDARD.md` · `PRO_MODE_STANDARDIZATION.md`

---

## 1. Overview

Before v1.18.0, every calculator page decided independently whether a user
could access a feature by checking a page-local boolean (`isPremiumUser`).
This was a two-tier system: free or authenticated ("pro"). It did not support
a middle "demo" tier, could not be overridden without editing HTML, and had
no single source of truth for what each page's gated features were.

The feature flag system introduced in v1.18.0 provides:

- **One canonical schema** (`js/rz-feature-flags.js`) listing every gated
  feature for every page and its availability per tier.
- **A three-tier model** — free / demo / pro — that maps to real user
  accounts already stored in `auth.js`.
- **A runtime helper API** (`window._rzFeatures`) so any page can call
  `_rzFeatures.has('page-key', 'feature-key')` instead of reading session
  state directly.
- **Per-page admin overrides** written to `localStorage` that take effect
  without deploying new code — used by the admin console to flip flags live.
- **A storage event listener** that fires `rz-features-changed` whenever the
  admin overrides change, so pages can react in real time.

---

## 2. Tier Definitions

| Tier   | Who gets it | Example accounts |
|--------|-------------|-----------------|
| `free` | Unauthenticated visitors — no active `rz_premium_session` | (anonymous) |
| `demo` | Users signed in with a demo account | `demo@resistancezero.com` |
| `pro`  | Users signed in with a standard or root account | `bagus@resistancezero.com`, `admin@resistancezero.com`, any account created via admin console |

Root accounts (`ROOT_EMAILS` in `auth.js`) resolve to the `pro` tier for
feature-flag purposes. Root status controls access to root-only pages
(DC Market Tracker, DataHall AI, etc.) separately via
`_rzAuth.isRootSession()`.

### Tier resolution order (runtime)

1. If `window._rzAuth.getTier()` is available (auth.js loaded), delegate.
2. Otherwise read `localStorage.rz_premium_session` directly and infer:
   - No session → `'free'`
   - `demo@*` email prefix → `'demo'`
   - `admin@*` or `bagus@*` prefix → `'pro'`
   - Any other authenticated email → `'pro'`

---

## 3. Schema

The schema lives in `window.RZ_FEATURE_FLAGS` (set by `js/rz-feature-flags.js`).

### Structure

```
RZ_FEATURE_FLAGS[pageKey][featureKey] = { free, demo, pro }
```

- **pageKey** — kebab-case identifier matching the page filename without
  `.html` (e.g. `'pue-calculator'`, `'spares-readiness-calculator'`).
- **featureKey** — kebab-case semantic identifier for the capability
  (e.g. `'pdf-export'`, `'monte-carlo-10000'`).
- Each tier field is a `boolean`: `true` means the tier can use the feature;
  `false` means it is locked.

### Minimal example

```js
window.RZ_FEATURE_FLAGS = {
  'pue-calculator': {
    'pdf-export':            { free: false, demo: true,  pro: true  },
    'pdf-watermark-removed': { free: false, demo: false, pro: true  },
    'advanced-mode':         { free: false, demo: true,  pro: true  }
  }
};
```

### Full page registry (14 pages as of v1.18.0)

| pageKey | Description |
|---------|-------------|
| `spares-readiness-calculator` | Spare parts readiness engine — 13 flags |
| `pue-calculator`              | PUE calculator — 11 flags |
| `capex-calculator`            | CAPEX calculator — 11 flags |
| `opex-calculator`             | OPEX calculator — 10 flags |
| `roi-calculator`              | ROI calculator — 10 flags |
| `tco-calculator`              | TCO calculator — 12 flags |
| `cx-calculator`               | CX / commissioning calculator — 13 flags |
| `carbon-footprint`            | Carbon footprint calculator — 9 flags |
| `tia-942-checklist`           | TIA-942 compliance checklist — 8 flags |
| `tier-advisor`                | Tier advisor tool — 8 flags |
| `rfs-readiness-workbench`     | RFS readiness workbench — 11 flags |
| `dc-market-tracker`           | DC market tracker — 9 flags |
| `datahallAI`                  | DataHall AI simulation — 6 flags |
| `dc-conventional`             | DC Conventional simulation — 6 flags |

Note: `datahallAI` and `dc-conventional` are root-only pages. All their flags
are set to `{ free: false, demo: false, pro: true }` — the page-level root
gate in auth.js still applies on top.

---

## 4. Helper API

### `window._rzFeatures.has(pageKey, featureKey)`

The primary access method. Returns `true` if the current user's tier has
access to the given feature on the given page.

```js
if (_rzFeatures.has('pue-calculator', 'pdf-export')) {
  // show PDF button
}
```

Admin overrides (see Section 6) are checked first; the canonical schema is
the fallback.

### `window._rzFeatures.getTier()`

Returns `'free'`, `'demo'`, or `'pro'` for the current session.

```js
var tier = _rzFeatures.getTier();
document.getElementById('tierBadge').textContent = tier.toUpperCase();
```

### `window._rzFeatures.listFeatures(pageKey)`

Returns an array of all feature keys registered for a page. Useful for
admin console UI and debugging.

```js
_rzFeatures.listFeatures('roi-calculator');
// ['advanced-mode', 'pdf-export', 'pdf-watermark-removed', ...]
```

### `window._rzFeatures.listPages()`

Returns an array of all registered page keys.

```js
_rzFeatures.listPages();
// ['spares-readiness-calculator', 'pue-calculator', ...]
```

### `window._rzAuth.getTier([session])`

The authoritative tier resolver in `auth.js`. Called by `_rzFeatures.getTier()`
when auth.js is loaded. Accepts an optional explicit session object.

```js
_rzAuth.getTier();           // tier for current session
_rzAuth.getTier(mySession);  // tier for a specific session object
```

### Event: `rz-features-changed`

Dispatched on `window` whenever the admin overrides localStorage key changes.
Pages that render gated UI should listen for this and re-apply gates.

```js
window.addEventListener('rz-features-changed', function () {
  applyGating();
});
```

---

## 5. Migration Path for Existing Pages

Existing pages use `var isPremiumUser = false` and inline session checks.
Migrate to the new helper as follows.

### Step 1 — Load the helper

Add `rz-feature-flags.js` to the page before the closing `</body>`:

```html
<script src="js/rz-feature-flags.js?v=20260514"></script>
```

It must load AFTER `auth.js` so `_rzAuth.getTier()` is available.

### Step 2 — Replace session checks

Before:
```js
var session = JSON.parse(localStorage.getItem('rz_premium_session') || 'null');
var isPremiumUser = session && new Date(session.expires) > new Date();
```

After:
```js
var isPremiumUser = (_rzFeatures.getTier() !== 'free');
```

### Step 3 — Replace feature-specific checks

Before:
```js
if (isPremiumUser) { exportPDF(); }
```

After:
```js
if (_rzFeatures.has('pue-calculator', 'pdf-export')) { exportPDF(); }
```

### Step 4 — Replace demo-specific branching

The three-tier model allows demo users to access a subset of pro features
without exposing full pro capabilities. Example:

```js
// Monte Carlo: demo gets 1000 iterations, pro gets 10000
var iterations = _rzFeatures.has('pue-calculator', 'monte-carlo-10000')
  ? 10000
  : _rzFeatures.has('pue-calculator', 'monte-carlo')
    ? 1000
    : 0;
```

### Step 5 — Listen for live changes

```js
window.addEventListener('rz-features-changed', function () {
  applyGating();   // your existing function that shows/hides gated UI
});
```

---

## 6. Admin Console Integration

The admin console (`rz-ops-p7x3k9m.html`) can override any feature flag
for any page at runtime without code deployment.

### Storage key

`rz_admin_features_by_page` (JSON string in localStorage)

### Override structure

```json
{
  "pue-calculator": {
    "pdf-export": { "free": true, "demo": true, "pro": true }
  },
  "tco-calculator": {
    "multi-scenario": { "free": false, "demo": true, "pro": true }
  }
}
```

When an override entry exists for a given `pageKey` + `featureKey`, it takes
precedence over the canonical schema for the matching tier. Tiers not covered
by the override fall back to the canonical schema — the override object is
merged at the feature level, not replaced wholesale.

### Broadcasting changes

When the admin console writes to `rz_admin_features_by_page`, open tabs on
other pages receive a `storage` event. `rz-feature-flags.js` listens for
this and fires `rz-features-changed` on `window` so pages can re-apply gating
without a full reload.

### Clearing overrides

```js
localStorage.removeItem('rz_admin_features_by_page');
window.dispatchEvent(new CustomEvent('rz-features-changed'));
```

---

## 7. Naming Conventions

### Page keys

- Use the filename without `.html`
- Use kebab-case
- Must match the filename exactly so callers can derive the key from
  `window.location.pathname`

```js
// Derive page key from pathname:
var pageKey = window.location.pathname.split('/').pop().replace('.html', '');
```

### Feature keys

- Use kebab-case: `'pdf-export'`, `'monte-carlo-10000'`
- Be semantic and self-documenting — prefer descriptive names over codes
- Group related features with a common prefix: `'monte-carlo-1000'`,
  `'monte-carlo-10000'` (not `'mc1k'`, `'mc10k'`)
- Use `'pdf-watermark-removed'` (not `'no-watermark'` or `'clean-pdf'`)
- Quantify when variants exist: `'monte-carlo-1000'` vs `'monte-carlo-10000'`

### Tier field names

Always lowercase: `free`, `demo`, `pro`. Never `Free`, `DEMO`, etc.

---

## 8. Worked Examples for Each Page

### 8.1 Spares Readiness Calculator

```js
// Show PDF export button only for demo and pro
if (_rzFeatures.has('spares-readiness-calculator', 'pdf-export')) {
  document.getElementById('btnExportPdf').style.display = 'inline-flex';
}

// Choose Monte Carlo iteration count
var mcIterations = 0;
if (_rzFeatures.has('spares-readiness-calculator', 'monte-carlo-10000')) {
  mcIterations = 10000;
} else if (_rzFeatures.has('spares-readiness-calculator', 'monte-carlo-1000')) {
  mcIterations = 1000;
}

// Gate the MEIO optimizer panel
var meioPanelLocked = !_rzFeatures.has('spares-readiness-calculator', 'meio-optimizer');
document.getElementById('meioPanelGate').classList.toggle('locked', meioPanelLocked);
```

### 8.2 PUE Calculator

```js
// Gate advanced inputs (economizer, transformer loss, PDU type, energy cost)
var advancedInputs = document.querySelectorAll('.pue-advanced-input');
var showAdvanced = _rzFeatures.has('pue-calculator', 'economizer-inputs');
advancedInputs.forEach(function (el) { el.style.display = showAdvanced ? '' : 'none'; });

// Render pro charts only when unlocked
if (_rzFeatures.has('pue-calculator', 'pro-charts')) {
  renderProCharts(pue);
}
```

### 8.3 CAPEX Calculator

```js
// Gate per-kW breakdown card
var perKwSection = document.getElementById('perKwSection');
if (perKwSection) {
  perKwSection.classList.toggle('gated', !_rzFeatures.has('capex-calculator', 'per-kw-breakdown'));
}

// PDF export
function exportPDF() {
  if (!_rzFeatures.has('capex-calculator', 'pdf-export')) { handlePremiumTab(); return; }
  var withWatermark = !_rzFeatures.has('capex-calculator', 'pdf-watermark-removed');
  buildAndPrintPDF(withWatermark);
}
```

### 8.4 OPEX Calculator

```js
// Scenario comparison is available to all tiers
var showComparison = _rzFeatures.has('opex-calculator', 'scenario-comparison'); // always true

// Full multi-scenario save/load requires pro
var canSave = _rzFeatures.has('opex-calculator', 'scenario-save');
var canMulti = _rzFeatures.has('opex-calculator', 'multi-scenario');
```

### 8.5 ROI Calculator

```js
// Detailed cashflow table
if (_rzFeatures.has('roi-calculator', 'cashflow-table')) {
  renderCashflowTable(result);
}

// Scenario analysis (3 pre-built scenarios)
if (_rzFeatures.has('roi-calculator', 'scenario-analysis')) {
  renderScenarioCards(scenarios);
}
```

### 8.6 TCO Calculator

```js
// Advanced inputs (colo escalation, cloud discount, debt/equity)
['tcoColoEsc','tcoCloudDiscount','tcoDebtEquity'].forEach(function (id) {
  var el = document.getElementById(id);
  if (el) el.disabled = !_rzFeatures.has('tco-calculator', 'colo-escalation-input');
});

// Watermark on free PDF
function buildPdfHeader(withWatermark) {
  withWatermark = !_rzFeatures.has('tco-calculator', 'watermark-removed');
  /* ... */
}
```

### 8.7 CX Calculator

```js
// Pro tabs (gate-pack, defect-aging, customer-witness, forecast)
var PRO_TABS = ['gate_pack','defect_aging','customer_witness','forecast'];
PRO_TABS.forEach(function (tab) {
  var flagMap = {
    gate_pack: 'gate-pack-report',
    defect_aging: 'defect-aging-report',
    customer_witness: 'customer-witness-mode',
    forecast: 'forecast-engine'
  };
  var canAccess = _rzFeatures.has('cx-calculator', flagMap[tab] || 'pro-panels');
  /* show or lock tab accordingly */
});

// Project/defect limits
var canAddProject  = _rzFeatures.has('cx-calculator', 'unlimited-projects')
  || existingProjects.length < 1;
var canAddDefect   = _rzFeatures.has('cx-calculator', 'unlimited-defects')
  || existingDefects.length < 25;
```

### 8.8 Carbon Footprint

```js
// Compliance panel (SBTi, GHG Protocol framework info)
if (_rzFeatures.has('carbon-footprint', 'compliance-panel')) {
  document.getElementById('panelCompliance').style.display = 'block';
}
```

### 8.9 TIA-942 Checklist

```js
// Advanced Tier 4 criteria
if (_rzFeatures.has('tia-942-checklist', 'advanced-tier-4')) {
  renderAdvancedTierCriteria();
}

// Gap export (CSV / PDF)
if (_rzFeatures.has('tia-942-checklist', 'gap-export')) {
  document.getElementById('btnGapExport').style.display = 'inline-flex';
}
```

### 8.10 Tier Advisor

```js
// Regional scoring panel
if (_rzFeatures.has('tier-advisor', 'regional-scoring') &&
    currentMode === 'pro') {
  regionalScore = calcRegional();
}
```

### 8.11 RFS Readiness Workbench

```js
// Snapshot comparison (requires pro)
function compareSnapshots() {
  if (!_rzFeatures.has('rfs-readiness-workbench', 'snapshot-comparison')) {
    showToast('Snapshot comparison requires Pro.', 'warning');
    return;
  }
  /* ... */
}

// Unit limit
var maxUnits = _rzFeatures.has('rfs-readiness-workbench', 'unlimited-units')
  ? Infinity
  : 3;
```

### 8.12 DC Market Tracker

```js
// Advanced analytics panels
if (_rzFeatures.has('dc-market-tracker', 'advanced-analytics')) {
  document.querySelectorAll('.dmt-pro-panel').forEach(function (p) {
    p.classList.remove('gated-overlay');
  });
}
```

### 8.13 DataHall AI

```js
// Root-only + pro-only: gate fires before feature check
if (!_rzAuth.isRootSession()) { showRootGate(); return; }
if (_rzFeatures.has('datahallAI', 'pro-views')) {
  renderAdvancedDashboard();
}
```

### 8.14 DC Conventional

```js
if (!_rzAuth.isRootSession()) { showRootGate(); return; }
if (_rzFeatures.has('dc-conventional', 'advanced-analytics')) {
  renderDetailedMetrics();
}
```

---

## 9. When to Add New Flags

Add a flag to the schema when:

1. A feature is currently gated behind `isPremiumUser` or an equivalent
   check and does not yet have a flag entry.
2. A feature needs different behaviour for demo vs pro (e.g. lower iteration
   count, watermarked output, read-only mode).
3. A feature is being introduced as pro-only and may be promoted to demo
   or free in a future release (the flag makes that a one-line schema change).
4. An admin needs the ability to toggle a feature for a specific user or
   session without code deployment.

Do NOT add a flag for:

- Features that are unconditionally available to all users (no gate needed).
- Page-level root gates — use `_rzAuth.isRootSession()` directly for those.
- UI theming, dark mode, or language preferences — not feature-tier concerns.

---

## 10. Anti-Patterns

### Direct tier comparison (WRONG)

```js
// BAD — bypasses overrides, couples code to tier names
var session = getSession();
if (session && session.tier === 'pro') { exportPDF(); }
```

```js
// GOOD — uses the flag system
if (_rzFeatures.has('pue-calculator', 'pdf-export')) { exportPDF(); }
```

### Checking isPremiumUser directly for new code (WRONG)

```js
// BAD — boolean cannot express demo-vs-pro distinctions
if (isPremiumUser) { renderMonteCarlo(10000); }
```

```js
// GOOD — fine-grained
var n = _rzFeatures.has('pue-calculator', 'monte-carlo-10000') ? 10000
       : _rzFeatures.has('pue-calculator', 'monte-carlo')       ? 1000
       : 0;
```

### Hardcoding demo email strings outside auth.js (WRONG)

```js
// BAD — brittle, duplicated
if (session.email === 'demo@resistancezero.com') { /* ... */ }
```

```js
// GOOD — tier already encodes this
if (_rzFeatures.getTier() === 'demo') { /* demo-specific UI hint */ }
```

### Skipping the `rz-features-changed` listener (WRONG)

Pages that gate UI at initial load but never react to the storage event will
appear stale when the admin console changes overrides in a live tab. Always
add the listener when a page uses `_rzFeatures.has()`.

---

## 11. File Locations

| File | Purpose |
|------|---------|
| `js/rz-feature-flags.js` | Canonical schema + `window._rzFeatures` runtime API |
| `auth.js` | Session management, `_rzAuth.getTier()`, `DEMO_EMAILS` |
| `standarization/FEATURE_FLAGS_STANDARD.md` | This document |
| `standarization/PRO_MODE_STANDARDIZATION.md` | Legacy 2-tier patterns (see deprecation note in that file) |

---

*Document maintained by the ResistanceZero development team.*
*Update this file whenever adding new page keys, feature keys, or tier rules.*
