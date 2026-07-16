# RZExplain — the ONE tooltip/explanation engine (v1.59.0)

Owner mandate (2026-07-16): every parameter, menu, submenu and tab on every surface
explains itself on hover — **content centralized, never hardcoded per page**. Terms
mentioned INSIDE a tooltip body (e.g. "DSCR") are themselves hoverable (nested terms).

## Architecture

| Piece | File | Role |
|---|---|---|
| Engine | `js/rz-explain.js` (`window.RZExplain`, guard `__rzExplain`) | One floating panel: hover-intent, keyboard focus, Escape, touch tap, viewport clamp with REAL rendered size, mobile bottom-sheet, nested-term navigation with breadcrumb, z-index 100002 (above tier gates). Self-injects CSS (finance-suite/token aware, light+dark). |
| Knowledge DB | `js/rz-explain-db.js` (`window.RZ_EXPLAIN_DB`) | **GENERATED — never edit by hand.** |
| Builder | `tools/build-explain-db.py` | glossary.html (354 terms, human source) + `tools/explain-extra.json` (curated super-detail) → DB. Curated wins on collision. Deterministic. |
| Curated source | `tools/explain-extra.json` | `{t, d, f?, u?, table?, s?, rel?, aliases?}` per key. |
| Gate | `tools/test-explain-db.mjs` | well-formed entries, ≥40-char bodies, rel resolve, alias dedupe, priority keys, deterministic rebuild. In ship suite. |

## The contract

1. **Content lives ONLY in the DB.** A page never writes tooltip text. To add/fix an
   explanation: edit `tools/explain-extra.json` (calculator/finance params) or
   glossary.html (general terms) → run `python3 tools/build-explain-db.py` → commit both.
2. **Pages opt in two ways:**
   - Explicit: `data-explain="key"` on any label/tab/heading/cell.
   - Scan: put `data-explain-scan` on a container → `RZExplain.scan()` wires known
     aliases in label/th/h2-4/button/[role=tab]/.metric-label/.input-label/.tab text
     (first occurrence per key, capped 300/page).
   Load order: `rz-explain-db.js` then `rz-explain.js` (both defer), cache-busted `?v=`.
3. **Nested terms are automatic**: aliases inside `d` bodies get wrapped; hover/tap
   navigates the panel with a ← back breadcrumb. Mention related concepts BY NAME in
   bodies; use `rel` for explicit related-chips.
4. **React (DCMOC)**: `dcmoc/src/components/ui/Explain.tsx` reads the same
   `window.RZ_EXPLAIN_DB` (script tag in layout.tsx); the existing `Tooltip.tsx` becomes
   a CONSUMER of DB content via key — never a second content store.
5. **Legacy tooltip families are DEPRECATED** (45+ per-page CSS families:
   `.tooltip-trigger`, `.tco-tooltip-*`, `.calc-tooltip`, …). No new instances.
   Migration status: `standarization/EXPLAIN_ROLLOUT.md`.
6. A11y (the old capex pattern failed all of these): triggers focusable (`tabindex=0`),
   `aria-describedby` while open, `role=tooltip` panel, Escape closes, hover-intent
   150 ms, reduced-motion honoured. axe 0/0 both themes required on adopting pages.

## Entry format (explain-extra.json)

```json
"dscr": {
  "t": "DSCR (Debt Service Coverage Ratio)",
  "d": "2-4 sentence engineering/finance-grade explanation. Mention related terms by name — they auto-link.",
  "f": "DSCR = NOI / Annual Debt Service",
  "u": "×",
  "table": [["Lender minimum","1.20–1.35×"]],
  "s": "Project-finance convention",
  "rel": ["equity-irr", "debt-ratio-leverage"],
  "aliases": ["DSCR", "Debt Service Coverage Ratio"]
}
```

## Adopted surfaces (v1)

capex-calculator (all inputs/outputs incl. deep-sea/refrigerant/space/renewables),
pue-calculator, glossary.html (terms cross-hover), articles (`rz-article-editorial.js`
scans the editorial body — first occurrence per term), DCMOC (27 tabs + Sensitivity
variables + KPI cards), Finance Terminal (tabs). Full family-by-family migration map:
`EXPLAIN_ROLLOUT.md`.
