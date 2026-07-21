/* ============================================================================
 * rz-manual-fab.js — shared floating "Technical Manual" button for calculators.
 * ----------------------------------------------------------------------------
 * Self-contained + self-injecting (same pattern as js/rz-cookie-consent.js):
 *   - derives the manual slug from an existing `a[href^="manual/"]` on the page
 *     (the legacy inline .rz-manual-link pill), else a filename→slug map;
 *   - removes the inline pill so there is ONE consistent manual entry point;
 *   - injects a fixed bottom-right FAB (book glyph + "manual" label) linking to
 *     manual/<slug>.html, stacked ABOVE the scroll-top / night-mode toggles;
 *   - injects its own guarded <style> so it looks identical even on pages that
 *     do not load styles.css (e.g. dc-market-tracker inline styling).
 * Instrument aesthetic: instrument-cyan, thin border, JetBrains Mono label,
 * dark-mode override, prefers-reduced-motion safe, hidden on print.
 * Standard: standarization/UI_FEATURES_STANDARD.md (Floating Technical-Manual button).
 * ==========================================================================*/
(function (w, d) {
  'use strict';
  if (w.__rzManualFab) { return; }
  w.__rzManualFab = true;

  // filename (without .html) → manual slug under /manual/
  var MAP = {
    'capex-calculator': 'capex', 'opex-calculator': 'opex', 'tco-calculator': 'tco',
    'roi-calculator': 'roi', 'pue-calculator': 'pue', 'carbon-footprint': 'carbon',
    'fire-calculator': 'fire', 'cx-calculator': 'cx', 'cdu-calculator': 'cdu-hub',
    'cdu-checklist': 'cdu-hub', 'cdu-hub': 'cdu-hub', 'tia-942-checklist': 'tia-942-checklist',
    'fire-checklist': 'fire-checklist', 'spares-readiness-calculator': 'spares',
    'rfs-readiness-workbench': 'rfs', 'tier-advisor': 'tier',
    'dc-market-tracker': 'dc-market-tracker'
  };

  function currentSlug() {
    var name = (w.location.pathname.split('/').pop() || '').replace(/\.html?$/i, '');
    return MAP[name] || null;
  }

  function resolveHref() {
    // 1) prefer an existing manual link already on the page (single source of truth)
    var a = d.querySelector('.rz-manual-link a[href*="manual/"], a[href^="manual/"], a[href*="/manual/"]');
    if (a) {
      var h = a.getAttribute('href');
      if (h && /manual\//.test(h)) { return h; }
    }
    // 2) fall back to the filename→slug map
    var slug = currentSlug();
    return slug ? ('manual/' + slug + '.html') : null;
  }

  function injectStyle() {
    if (d.getElementById('rzManualFabStyle')) { return; }
    var css =
      '.rz-manual-fab{position:fixed;right:20px;bottom:140px;z-index:600;display:inline-flex;' +
      'align-items:center;gap:6px;padding:8px 12px;border-radius:10px;text-decoration:none;' +
      "font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.72rem;" +
      'font-weight:600;letter-spacing:0.04em;line-height:1;color:#0b0f14;background:#00DDFF;' +
      'border:1px solid #00DDFF;box-shadow:0 4px 14px rgba(0,221,255,0.28);' +
      'transition:transform .18s ease,box-shadow .18s ease,background .18s ease;}' +
      '.rz-manual-fab:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,221,255,0.42);background:#22e6ff;}' +
      '.rz-manual-fab svg{width:15px;height:15px;flex:0 0 auto;}' +
      '.rz-manual-fab .rz-mf-label{white-space:nowrap;}' +
      '[data-theme="dark"] .rz-manual-fab{color:#031016;background:#00DDFF;border-color:#00DDFF;' +
      'box-shadow:0 4px 14px rgba(0,221,255,0.22);}' +
      '[data-theme="dark"] .rz-manual-fab:hover{background:#22e6ff;}' +
      '@media (max-width:768px){.rz-manual-fab{right:14px;bottom:150px;padding:7px 10px;font-size:0.68rem;}}' +
      '@media (prefers-reduced-motion:reduce){.rz-manual-fab{transition:none;}.rz-manual-fab:hover{transform:none;}}' +
      '@media print{.rz-manual-fab{display:none !important;}}';
    var s = d.createElement('style');
    s.id = 'rzManualFabStyle';
    s.textContent = css;
    d.head.appendChild(s);
  }

  function build() {
    var href = resolveHref();
    if (!href) { return; }                       // not a known calculator → skip
    if (d.querySelector('.rz-manual-fab')) { return; }

    // De-dupe: remove the legacy inline pill(s) so there is one entry point.
    var pills = d.querySelectorAll('.rz-manual-link');
    for (var i = 0; i < pills.length; i++) {
      if (pills[i].parentNode) { pills[i].parentNode.removeChild(pills[i]); }
    }

    injectStyle();
    var link = d.createElement('a');
    link.className = 'rz-manual-fab';
    link.href = href;
    link.setAttribute('aria-label', 'Technical Manual & Methodology');
    link.setAttribute('title', 'Technical Manual & Methodology');
    // book glyph + label
    link.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>' +
      '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>' +
      '<span class="rz-mf-label">manual</span>';
    d.body.appendChild(link);
  }

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', build, { once: true });
  } else {
    build();
  }
})(window, document);
