/**
 * Static page-key registry.
 *
 * The rz-ops Feature Access matrix UI (Phase 4) renders one column per
 * key here, and the per-user/per-tier `featureOverrides` dictionary uses
 * exactly these strings as its keys. Keep this list in sync with the
 * actual page-access gates in `js/auth.js` (`enforceTierFeatureAccess`)
 * and `js/rz-feature-flags.js` matrix columns.
 *
 * NOT loaded from KV on purpose:
 *   - Page keys are part of the application contract (compile-time-ish),
 *     not user-editable data.
 *   - Avoids a round-trip on every admin matrix render.
 *   - Single source of truth lives in the deployed Worker bundle.
 *
 * To add/remove a page key:
 *   1. Edit this array.
 *   2. Wire the corresponding `enforceTierFeatureAccess('<key>')` call into
 *      the new page.
 *   3. Bump the Worker (`wrangler deploy`) so the matrix UI sees it.
 */

export const PAGE_KEYS = Object.freeze([
  { key: 'datahall-ai',            label: 'DC AI' },
  { key: 'dc-conventional',        label: 'DC Conventional' },
  { key: 'dcmoc',                  label: 'DCMOC' },
  { key: 'datacenter-solutions',   label: 'DC Solutions Hub' },
  { key: 'ltc-system-modelling-lab', label: 'LTC Modelling Lab' },
  { key: 'ltc-ashrae',             label: 'LTC ASHRAE' },
  { key: 'ltc-uptime',             label: 'LTC Uptime' },
  { key: 'ltc-ansi-tia',           label: 'LTC ANSI/TIA' },
  { key: 'ltc-iso-energy',         label: 'LTC ISO Energy' },
  { key: 'ltc-nfpa',               label: 'LTC NFPA' },
  { key: 'standards-ltc-lab',      label: 'LTC Standards' },
  { key: 'pue-calculator',         label: 'PUE Calc' },
  { key: 'capex-calculator',       label: 'CAPEX Calc' },
  { key: 'opex-calculator',        label: 'OPEX Calc' },
  { key: 'roi-calculator',         label: 'ROI Calc' },
  { key: 'tco-calculator',         label: 'TCO Calc' },
  { key: 'cx-calculator',          label: 'CX Calc' },
  { key: 'dc-market-tracker',      label: 'DC Market Tracker' },
  { key: 'tia-942-checklist',      label: 'TIA-942 Checklist' },
  { key: 'tier-advisor',           label: 'Tier Advisor' },
  { key: 'rfs-readiness-workbench', label: 'RFS Workbench' },
  { key: 'finance-terminal',       label: 'Finance Terminal' },
  { key: 'dc-market',              label: 'DC Market' },
]);
