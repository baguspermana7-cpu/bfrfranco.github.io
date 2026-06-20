# CDU Selection & Deployment Guide — Detailed Plan

> Owner request (2026-06-14): a dc-solutions resource to compare Top-10 CDUs
> (in-row + in-rack) + other liquid-cooling CDU types, with REAL vendor data,
> links to each unit's installation + operation + manual, a super-detailed
> deployment checklist, and a maintenance strategy.
> Decisions: REAL vendor links · ONE main page, built deeply · staged ships.

## Page

`cdu-selection-guide.html` (new, public, indexable). Registered as a card on
`datacenter-solutions.html` + `tools.html` grids. Uses the site's standard
nav + dark/light theme + version stamp + mobile-responsive checkpoints.

## Sections (the "really detailed" deliverable)

1. **Hero + intro** — what a CDU is, primary vs secondary loop, where it sits
   in the liquid-cooling chain (facility water → CDU → manifold → cold plate).
2. **CDU type taxonomy** — in-row · in-rack · sidecar · liquid-to-liquid (L2L)
   · liquid-to-air (L2A) · facility/room-scale · immersion manifolds. Capacity
   ranges, use-cases, pros/cons each. Diagram.
3. **Top-10 IN-ROW CDU comparison table** — vendor, model, kW, flow, loop,
   redundancy, footprint, + per-row links: product page · datasheet ·
   install manual · O&M manual.
4. **IN-RACK CDU comparison table** (~5 models) — same columns.
5. **Other types reference** — sidecar / L2L vs L2A / facility-scale (1MW+) /
   immersion. Short cards with links.
6. **Installation deep-dive** — coolant spec (PG25/30, DI water, dielectric),
   quick-disconnect standards, filtration micron rating, leak detection,
   commissioning/flush/pressure-test sequence, water-quality standards
   (ASHRAE liquid-cooling guidelines / OCP). Step-by-step.
7. **Super-detailed DEPLOYMENT CHECKLIST** — phased: design → procurement →
   site-prep → mechanical install → fluid fill/flush → commissioning →
   integration (BMS/leak) → handover. Each phase a checkbox list with the
   real gotchas. (interactive checkboxes + print/export.)
8. **MAINTENANCE STRATEGY** — PM table: task · interval · standard reference.
   Coolant sampling/replacement, filter swap, pump seal/bearing, leak-test,
   flow/dP calibration, HX cleaning. Predictive vs preventive.
9. **Manual / documentation hub** — per-vendor support-portal links.
10. **Disclaimer** — educational; verify specs with vendor; not procurement
    advice (site standard calc/tool disclaimer).

## Data source

Real vendor data + manual links from the research agent (Vertiv, Motivair,
CoolIT, Boyd, Stulz, nVent, Schneider, Delta, ZutaCore, Accelsius, etc.).
Every spec cites a source; estimates flagged "verify with vendor". ASHRAE
TC 9.9 + OCP cooling docs for install/maintenance standards.

## LINK VALIDATION MANDATE (owner 2026-06-14: "pastikan linknya valid anda baca dan pelajari dulu linknya")

Every link that ships on the page MUST be verified, not guessed:
- The link was actually fetched and returns 200 (not 404/403/redirect-to-home).
- The page content matches what the link claims (the datasheet really shows that model).
- Status tag per link: `VERIFIED` (fetched + correct) · `VENDOR PORTAL` (working
  docs/support search where the manual lives) · never ship `UNVERIFIED` deep links.
- If a manual PDF is login-gated/not publicly linkable, link the vendor's verified
  documentation portal instead, and say so.
- Where data is thin → DIVE DEEPER for the actual datasheet/spec PDF (real kW, L/min,
  dP, dimensions, fluid spec, filtration micron, QD standard).
- Prefer fewer fully-verified models over many shaky ones.
- Before publishing the page: re-run a link-check on every href (curl -I / HEAD 200).

## Staged ships

- **Ship 1 (v1.43.2x)** — page scaffold + type taxonomy + in-row Top-10 table
  + in-rack table (core comparison + verified links). + REQUIRED mobile-
  responsive checkpoints (the audit FAILed first pass — must fix). Register on
  dc-solutions.
- **Ship 2** — installation deep-dive + **super-detailed deployment checklist**
  (interactive, phased, print/export) + **maintenance checklist** (PM table) +
  **symptom / troubleshooting table** (issue → likely cause → action) +
  **printable document FORM** for the checklist (fill + print/export, blank
  fields for site/date/tech/sign-off).
- **Ship 3** — maintenance strategy narrative + manual hub + polish + SEO +
  sitemap + search-index + llms + glossary CDU term.

## Owner scope expansion (2026-06-14)

"jadi bukan hanya selection ya, juga maintenancenya buat checklist maintenance,
symptom table klw ada issu ini itu harus bagaimana, ada detailnya anda juga
harus buat document form utk checklistnya" — the page is NOT only selection. It
must also carry:
1. **Maintenance checklist** — PM tasks · interval · reference (daily/weekly/
   monthly/quarterly/annual).
2. **Symptom / troubleshooting table** — for each fault symptom (high dP, low
   flow, leak alarm, high coolant temp, pump fault, filter clog, air in loop,
   etc.): likely cause → immediate action → corrective action.
3. **Printable document FORM** — a real checklist form with blank fields
   (site, CDU tag, date, technician, readings, pass/fail, sign-off) that the
   user can fill on-screen and PRINT / export (CSS print stylesheet).

## Cross-linkage (CONTENT_LINKAGE_PLAYBOOK)

New tool/page → register in: datacenter-solutions.html, tools.html, rz-ops
admin (if applicable), sitemap.xml, search-index.json, llms.txt, glossary
(CDU term). Version bump + changelog + sw + gates each ship.

## Verification per ship

audit-script-tags · audit-js-syntax · audit-version-stamp · audit-mobile-
responsive · audit-seo. Headless render check (table populates, links resolve,
checklist toggles, dark/light both OK). Screenshot to owner.
