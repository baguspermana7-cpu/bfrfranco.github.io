# Tech Spec PDF — "Generate Design" standardization

> Standardization doc for the "Generate Design" / FAQ feature on the DC AI
> and Conventional DC cockpit pages. First shipped in v1.30.0 (2026-05-23).

## Purpose

Owner brief: produce a deep, engineering-grade Tech Specification PDF — at
least 200–300 pages — from the locked engine state on each cockpit. Every
number must be derived (not hardcoded) from the on-page calculation engine
so the PDF and the visible mimic always agree. Each cockpit also gets its
own FAQ button so questions a stakeholder might ask have a canonical
answer adjacent to the visible state.

The buttons live in the page header next to the existing theme toggle:

| Page | Button id | Engine source |
|---|---|---|
| `datahallAI.html` | `genDesignTrig` + `faqTrig` | `window.DATAHALL_CALC` + `window.DATAHALL_MODEL` |
| `dc-conventional.html` | `genDesignTrigConv` + `faqTrigConv` | `window.CONV_CALC.snapshot` |

The Basis-of-Design button (`bodTrig`) stays on the DC AI cockpit as a
focused 14-page summary. The Tech Spec PDF is a separate, much longer
document.

## Build pattern (reused from BoD)

The PDF is built with the established print-window pattern:

```js
function exportTechSpecPdf(){
  var html = buildTechSpecHtml();   // returns full <!DOCTYPE>...<html>
  var win = window.open('', '_blank');
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(function(){ win.print(); }, 600);
}
```

Inside `buildTechSpecHtml()` the body assembles with string concatenation:

- `E(s)` — HTML-escape
- `R(rows)` — render a 3-column table (Parameter / Value / Basis)
- `TC(title, sub)`, `FC(title)` — auto-numbered table & figure captions
- `WK(title, formula, subst, result, ref)` — worked-calculation block:
  formula line, substituted line, result line, reference line.
- `grabSVG(hostId)` — clone the inline SVG mimic for embedding in the PDF

> **`<\/script>` escape rule applies.** Any `</script>` token that appears
> inside a JS string literal MUST be written as `<\/script>` because the
> HTML tokenizer is not JS-aware and will close the surrounding
> `<script>` element early otherwise. The `audit-script-tags.py --strict`
> gate enforces this on every push.

## Page CSS conventions

- A4 size · 18mm top/bottom · 14mm sides.
- Title page (`.page.title`) suppresses running header/footer via
  `@page:first { @top-left{content:""} @top-right{content:""} }`.
- Running headers on subsequent pages name the document and a
  scenario-lock tag.
- `@media print` adds `page-break-after: always` on `.page`, and
  `page-break-inside: avoid` on `.wk`, `.t`, `tr`.

## Content scaffold (v1.30.0)

Both pages ship the same scaffold structure:

1. Title page (1 pp)
2. Table of contents (1 pp)
3. Section 1 — Executive Summary & Design Philosophy (1 pp)
4. Section 2 — Site & Facility Parameters (1 pp)
5. Section 3 — Anchor discipline (~1 pp) — Compute for DC AI, Power for
   DC Conv
6. Section 4–8 placeholder anchors (expand in v1.30.1 / v1.30.2)
7. References (1 pp)
8. Appendix A — Formula derivations (1 pp)

Target ~60 logical pages today; ~200–300 pages by v1.30.3. The
intermediate ships (v1.30.1 expands DC AI; v1.30.2 expands DC Conv;
v1.30.3 cross-links + Index + final polish) each layer on additional
discipline sections without changing the build pattern.

## FAQ dialog convention

The FAQ is a single `<dialog>`-style overlay with native `<details>`
items so the markup remains accessible (keyboard navigation, screen-reader
"summary" announcement, `aria-modal=true` on the overlay). 10 Q&A pairs
per page, each authored to match the page's actual numerical state by
reading from the engine at open-time.

DC AI FAQ: `openFaqDialog()` at `datahallAI.html`. DC Conv FAQ:
`openFaqDialog()` at `dc-conventional.html`. Both close on backdrop click
or × button.

## Verification

Per ship:

- `python3 tools/audit-script-tags.py --strict` (every `</script>` in JS
  strings escaped)
- `python3 tools/audit-js-syntax.py --strict`
- `python3 tools/audit-version-stamp.py --strict`
- `python3 tools/audit-mobile-responsive.py --strict`
- `node tools/test-datahall-calc.mjs` (57/57)
- `node tools/test-conv-calc.mjs` (22/22)
- Engine files byte-identical (`git diff HEAD -- js/datahall-model.js
  js/datahall-calculations.js js/conv-engine.js | wc -l` == 0)
- `#p-dash` panel + `updateDashKPI()` + `dcCallouts` byte-identical on
  `datahallAI.html` (owner exclusion).

## Roadmap

| Ship | Pages | What lands |
|---|---|---|
| v1.30.0 | ~60 / ~60 | Scaffold + anchor discipline + FAQ — DC AI + DC Conv |
| v1.30.1 | ~220 / — | DC AI expands all 8 disciplines |
| v1.30.2 | — / ~210 | DC Conv expands all 8 disciplines |
| v1.30.3 | polish | Cross-links between PDF and FAQ, in-PDF Index, fairness disclaimer pass, page-break tightening |
