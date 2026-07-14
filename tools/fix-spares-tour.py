#!/usr/bin/env python3
"""Idempotent fixes for the spares-readiness-calculator guided tour.

Root cause of the owner-reported "dark screen after cookie Accept": the tour
overlay auto-launches 1.2s after first visit; its spotlight paints a full-page
scrim, the tooltip could render off-viewport, and the overlay had
pointer-events:none (no click/Escape dismiss). Fixes:
  1. scrollIntoView target before measuring its rect
  2. clamp tooltip's initial top into viewport
  3. re-clamp with real height after display:block (already shipped; skipped if present)
  4. overlay click + Escape dismiss (spotlight pointer-events:none)
  5. auto-launch waits for cookie-consent decision (rz-cookie-consent event)
Run: python3 tools/fix-spares-tour.py   (safe to re-run)
"""
import sys, pathlib

PAGE = pathlib.Path(__file__).resolve().parent.parent / 'spares-readiness-calculator.html'
s = PAGE.read_text(encoding='utf-8')
orig = s
applied, skipped = [], []


def rep(name, old, new):
    global s
    if new in s:
        skipped.append(name)
        return
    if old not in s:
        print(f'FAIL anchor not found: {name}')
        sys.exit(1)
    s = s.replace(old, new, 1)
    applied.append(name)


# 1. scroll target into view before measuring
rep('scrollIntoView',
    "  if (targetEl) {\n    var rect = targetEl.getBoundingClientRect();",
    "  if (targetEl) {\n    try { targetEl.scrollIntoView({block:'center'}); } catch(e) { targetEl.scrollIntoView(); }\n    var rect = targetEl.getBoundingClientRect();")

# 2. clamp initial tooltip top into viewport
rep('initial top clamp',
    "    tt.style.top = Math.max(10, ttTop) + 'px';",
    "    tt.style.top = Math.min(Math.max(10, ttTop), window.innerHeight - 190) + 'px';")

# 3. re-clamp after display:block (real height) — may already be shipped
rep('after-display clamp',
    "  tt.style.display = 'block';\n}",
    "  tt.style.display = 'block';\n  /* re-clamp with the tooltip's REAL height (rect is zero while display:none) */\n  var ttRect = tt.getBoundingClientRect();\n  if (ttRect.bottom > window.innerHeight - 10) {\n    tt.style.top = Math.max(10, window.innerHeight - ttRect.height - 10) + 'px';\n  }\n  if (parseFloat(tt.style.top) < 10) tt.style.top = '10px';\n}")

# 4a. overlay accepts clicks (dismiss); spotlight stays transparent to clicks
rep('overlay pointer-events',
    ".tour-overlay { position: fixed; inset: 0; z-index: 8000; pointer-events: none; }",
    ".tour-overlay { position: fixed; inset: 0; z-index: 8000; pointer-events: auto; cursor: pointer; }")
rep('spotlight pointer-events',
    ".tour-spotlight { position: absolute; border-radius: 12px;",
    ".tour-spotlight { position: absolute; border-radius: 12px; pointer-events: none;")

# 4b + 5. dismiss handlers + consent-sequenced auto-launch
rep('auto-launch sequencing',
    """/* Auto-launch tour on first visit */
(function() {
  try {
    if (!localStorage.getItem('cse_tour_done')) {
      setTimeout(tourStart, 1200);
    }
  } catch(e) {}
})();""",
    """/* Escape / overlay-click dismiss + auto-launch sequenced after cookie consent */
(function() {
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var ov = document.getElementById('tourOverlay');
      if (ov && ov.style.display !== 'none') tourEnd();
    }
  });
  var ovEl = document.getElementById('tourOverlay');
  if (ovEl) ovEl.addEventListener('click', function(e) { if (e.target === ovEl) tourEnd(); });
  try {
    if (localStorage.getItem('cse_tour_done')) return;
    if (localStorage.getItem('rz_cookie_consent')) {
      setTimeout(tourStart, 1200);
    } else {
      var launched = false;
      document.addEventListener('rz-cookie-consent', function() {
        if (launched) return;
        launched = true;
        setTimeout(tourStart, 600);
      });
    }
  } catch(e) {}
})();""")

if s != orig:
    PAGE.write_text(s, encoding='utf-8')
print('applied:', applied or 'none')
print('skipped (already present):', skipped or 'none')
