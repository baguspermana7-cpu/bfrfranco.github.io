/* rz-hub-icons.js — one line glyph per tool on the DC Solutions hub (PLAN H3, 2026-10-16).
 *
 * The cockpit and engineering rows reuse the IEC 60617 / ISA-5.1 glyphs the drawings already use
 * (RZEngSymbols, 48-box, 2px currentColor strokes); the planning, market, grid and knowledge rows
 * get glyphs authored in the same box and the same stroke so the catalogue reads as one set. Each
 * glyph is keyed by the row's href, so a row with no glyph simply shows none — nothing generic.
 * ES5, zero deps beyond rz-eng-symbols.js.
 */
(function (root) {
  'use strict';
  var LIB = root.RZEngSymbols;
  /* authored in the 0..48 box; stroke/fill inherit from the <svg> wrapper */
  var OWN = {
    /* K.04 data hall heat map */
    'datahall.html': '<rect x="8" y="8" width="32" height="32" rx="2"/><path d="M8 19h32M8 29h32M19 8v32M29 8v32"/><rect x="20" y="20" width="8" height="8" fill="currentColor" stroke="none" opacity=".7"/><rect x="30" y="9" width="9" height="9" fill="currentColor" stroke="none" opacity=".35"/>',
    /* A.01 CAPEX — a building plate with its floors */
    'capex-calculator.html': '<path d="M10 40V14l14-6 14 6v26"/><path d="M6 40h36M17 22h4M27 22h4M17 30h4M27 30h4M21 40v-6h6v6"/>',
    /* A.02 OPEX — a meter, the needle past half */
    'opex-calculator.html': '<path d="M8 34a16 16 0 0 1 32 0"/><path d="M24 34 32 22"/><circle cx="24" cy="34" r="2.5" fill="currentColor" stroke="none"/><path d="M11 29h3M34 29h3M24 18v3M8 40h32"/>',
    /* A.03 DC MOC — a Monte Carlo cloud under its distribution */
    'dcmoc/': '<path d="M8 36c6 0 7-20 16-20s10 20 16 20"/><circle cx="14" cy="34" r="1.6" fill="currentColor" stroke="none"/><circle cx="20" cy="30" r="1.6" fill="currentColor" stroke="none"/><circle cx="25" cy="26" r="1.6" fill="currentColor" stroke="none"/><circle cx="30" cy="31" r="1.6" fill="currentColor" stroke="none"/><circle cx="35" cy="35" r="1.6" fill="currentColor" stroke="none"/><path d="M8 40h32"/>',
    /* A.04 Cx — the clipboard with its levels ticked */
    'cx-calculator.html': '<rect x="11" y="10" width="26" height="30" rx="2"/><path d="M18 10V7h12v3"/><path d="M16 21l3 3 5-6M16 31l3 3 5-6M27 21h6M27 31h6"/>',
    /* A.05 RFS — gates on a line, one passed */
    'rfs-readiness-workbench.html': '<path d="M6 24h36"/><path d="M14 18l6 6-6 6-6-6zM30 18l6 6-6 6-6-6z"/><path d="M11 24l2 2 4-4"/>',
    /* A.06 spares — an open crate with a part out */
    'spares-readiness-calculator.html': '<path d="M8 20v18h32V20"/><path d="M8 20l6-8h20l6 8H8z"/><path d="M20 20v6h8v-6"/><path d="M24 12V5M21 8l3-3 3 3"/>',
    /* B.01 TCO — three cost lines to 2030 */
    'tco-calculator.html': '<path d="M8 8v32h32"/><path d="M12 32l8-6 8 2 10-10"/><path d="M12 36l8-2 8-6 10-2" stroke-dasharray="3 3"/><path d="M12 28l8-8 8 6 10-14" opacity=".55"/>',
    /* B.02 ROI — bars with the return arrow through them */
    'roi-calculator.html': '<path d="M8 40h32"/><rect x="11" y="28" width="6" height="12"/><rect x="21" y="22" width="6" height="18"/><rect x="31" y="14" width="6" height="26"/><path d="M10 20l10-6 8 4 12-10"/><path d="M34 8h6v6"/>',
    /* B.03 market tracker — the globe with its meridians */
    'dc-market-tracker.html': '<circle cx="24" cy="24" r="16"/><path d="M8 24h32M24 8c-6 6-6 26 0 32M24 8c6 6 6 26 0 32"/><path d="M12 15c7 3 17 3 24 0M12 33c7-3 17-3 24 0"/>',
    /* C.01 PUE — a gauge reading low */
    'pue-calculator.html': '<path d="M8 32a16 16 0 0 1 32 0"/><path d="M8 32h4M36 32h4M24 16v4M13 21l3 3M35 21l-3 3"/><path d="M24 32l-7-9"/><circle cx="24" cy="32" r="2.5" fill="currentColor" stroke="none"/>',
    /* C.02 tier advisor — four steps, I to IV */
    'tier-advisor.html': '<path d="M6 40h36"/><path d="M8 40v-6h8v-6h8v-8h8v-8h8"/><path d="M12 38v-2M20 32v-2M28 24v-2M36 16v-2"/>',
    /* C.03 TIA-942 checklist */
    'tia-942-checklist.html': '<rect x="9" y="8" width="30" height="32" rx="2"/><path d="M14 17l2 2 4-4M14 25l2 2 4-4M14 33l2 2 4-4M24 16h10M24 24h10M24 32h10"/>',
    /* C.04 carbon — the cloud and its scope arrows */
    'carbon-footprint.html': '<path d="M14 34a7 7 0 0 1 1-14 10 10 0 0 1 19-2 7 7 0 0 1 2 16H14z"/><path d="M18 40v-4M24 42v-6M30 40v-4"/>',
    /* C.08 air vs liquid — fan on the left, the drop on the right */
    'compare-air-vs-liquid-cooling.html': '<path d="M24 6v36"/><circle cx="14" cy="24" r="2"/><path d="M14 22c-2-6 2-10 2-10s2 6-2 10zM14 26c2 6-2 10-2 10s-2-6 2-10zM12 24c-6-2-10 2-10 2s6 2 10-2z"/><path d="M34 14c-5 7-8 11-8 15a8 8 0 0 0 16 0c0-4-3-8-8-15z"/>',
    /* C.09 raised floor vs slab — tiles over void, slab beside */
    'compare-raised-floor-vs-slab.html': '<path d="M6 20h18M6 28h18M12 20v8M18 20v8"/><path d="M8 28v8M22 28v8M6 36h18"/><rect x="28" y="24" width="14" height="12"/><path d="M28 30h14" stroke-dasharray="2 2"/>',
    /* G.01 Java–Bali grid — a transmission tower */
    'pln-java-grid.html': '<path d="M18 42l4-28h4l4 28"/><path d="M14 20h20M10 28h28M16 14h16"/><path d="M14 20l-4 8M34 20l4 8M22 14l-6 6M26 14l6 6"/><path d="M20 28l-2 14M28 28l2 14"/>',
    /* L.01 standards LTC lab — a chip under its cold plate and loop */
    'standards-ltc-lab.html': '<rect x="14" y="20" width="20" height="14" rx="1"/><path d="M14 18h20M18 20v-6M24 20v-6M30 20v-6"/><path d="M8 40c4 0 4-4 8-4s4 4 8 4 4-4 8-4 4 4 8 4"/>',
    /* L.02 system modelling — nodes and their edges */
    'ltc-system-modelling-lab.html': '<circle cx="12" cy="14" r="4"/><circle cx="36" cy="14" r="4"/><circle cx="24" cy="34" r="4"/><circle cx="24" cy="22" r="3"/><path d="M15 16l6 4M33 16l-6 4M24 25v5"/>',
    /* L.04 AI maintenance — a wrench */
    'ai-engineering-maintenance.html': '<path d="M30 8a9 9 0 0 0-8 13L9 34a3 3 0 0 0 4 4l13-13a9 9 0 0 0 13-8l-6 6-5-1-1-5 6-6a9 9 0 0 0-3-3z"/>',
    /* P.01 article 13 — the paper */
    'article-13.html': '<path d="M12 8h16l8 8v24H12z"/><path d="M28 8v8h8M17 24h14M17 30h14M17 36h8"/>',
    /* P.03 power pillar — the bolt */
    'pillar-power.html': '<path d="M27 6L12 27h10l-2 15 15-21H25z"/>',
    /* P.04 standards pillar — the bound book */
    'pillar-standards.html': '<path d="M10 10h22a4 4 0 0 1 4 4v26H14a4 4 0 0 1-4-4z"/><path d="M14 36h22M10 10v26M18 16h12M18 22h12"/>',
    /* P.06 sustainability — the leaf on its vein */
    'pillar-sustainability.html': '<path d="M38 10c-20 0-28 10-28 24 14 0 26-6 28-24z"/><path d="M10 40c6-10 14-16 22-20"/>',
    /* P.07 incidents — the warning plate */
    'dc-incidents.html': '<path d="M24 8L4 40h40z"/><path d="M24 20v10M24 34v1"/>',
    /* P.08 manuals — the open book */
    'manual/': '<path d="M24 14c-4-3-10-3-16-2v26c6-1 12-1 16 2 4-3 10-3 16-2V12c-6-1-12-1-16 2z"/><path d="M24 14v26"/>'
  };
  /* library glyphs for the rest, keyed by href */
  var LIBKEY = {
    'datahallAI.html': 'rack', 'dc-conventional.html': 'bms', 'EPMS_Telemetry.html': 'breaker', 'chiller-plant.html': 'chiller',
    'fire-system.html': 'sprinkler', 'fuel-system.html': 'fuel', 'water-system.html': 'pump', 'ict.html': 'fabric',
    'fire-calculator.html': 'agentCylinder', 'fire-checklist.html': 'smokeDetector', 'cdu-hub.html': 'cdu',
    'pln-sumatra-grid.html': 'utility', 'network-visualization-hub.html': 'patchPanel', 'pillar-cooling.html': 'tempSensor',
    'pillar-fire-safety.html': 'heatDetector', 'article-13.html': null
  };
  function markup(href) {
    if (OWN[href]) return OWN[href];
    var k = LIBKEY[href]; return (k && LIB && LIB.MARKUP[k]) || '';
  }
  function svg(href, size) {
    var m = markup(href); if (!m) return '';
    return '<svg viewBox="0 0 48 48" width="' + (size || 20) + '" height="' + (size || 20) + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + m + '</svg>';
  }
  /* Give every catalogue row its glyph, as the first cell; the tint comes from the group. */
  function mount(root_) {
    var rows = (root_ || document).querySelectorAll('a.tool[href]'), n = 0;
    for (var i = 0; i < rows.length; i++) {
      var a = rows[i], href = a.getAttribute('href'); if (a.querySelector('.ic')) continue;
      var s = svg(href, 20); if (!s) continue;
      var ic = document.createElement('span'); ic.className = 'ic'; ic.innerHTML = s;
      a.insertBefore(ic, a.firstChild); n++;
    }
    return n;
  }
  root.RZHubIcons = { markup: markup, svg: svg, mount: mount, OWN: OWN, LIBKEY: LIBKEY };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mount(); }); else mount();
  }
})(typeof window !== 'undefined' ? window : this);
