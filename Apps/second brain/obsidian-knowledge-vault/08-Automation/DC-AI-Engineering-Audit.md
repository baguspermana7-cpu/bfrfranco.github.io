---
id: dcai-audit
title: DC AI BMS — Engineering Audit & Improvement Roadmap
file: /home/baguspermana7/rz-work/Automation/DC AI/Engineering-Audit-2026-05-01.md
group: automation
tags: [bms, scada, dcai, audit, p&id, sld, ldc, iec-62443]
last_updated: 2026-08-30
status: private
gitignored: true
parent: [[DataHall-AI]]
---

# DC AI BMS — Engineering Audit (private, gitignored)

> **NOT public.** Lives in `/home/baguspermana7/rz-work/Automation/DC AI/`. Folder added to repo `.gitignore` at commit `30d99b0`.

## What this document is

A 547-line engineering audit + improvement roadmap for `datahallAI.html` (the DC AI BMS simulation page). Driven by user feedback: the page is visually rich but engineering-implausible — symbols, setpoints, and topology don't survive scrutiny by a real DC engineer.

## Top 3 credibility blockers identified

1. **Cooling & Piping** is drawn with cartoon shapes, not ISA-5.1 P&ID symbols. No setpoints, no loop split, no lead-lag.
2. **Electrical SLD** has no IEC 60617 symbols, no equipment IDs, no ANSI relay codes (50/51/87/etc.), no arc-flash labels.
3. **BMS Architecture** is missing the **LDC (Local Display Controller) layer** + IEC 62443 zone segmentation + alarm-management server.

## Phased roadmap

| Phase | Effort | Wins |
|---|---|---|
| **P0** — engineering credibility | 1–2 days | P&ID redraw, IEC 60617 SLD, LDC layer, visual style global pass |
| **P1** — operator-grade detail | 2–3 days | Real-time PV+SP, alarm-priority colour code, trend mini-charts, lead-lag rotation |
| **P2** — code-compliance polish | 1–2 days | Arc-flash labels, NFPA/ASHRAE/IEC standards-citation footers, aerial callouts, LOTO permits |

## Visual style calibration (mandatory across all tabs)

- **Lines**: 0.6–1.4 px tier-graded — never the 3-4 px slabs
- **Colour**: pull back saturated greens/cyans for *decoration*; reserve for *state* (running/alarm/locked-out)
- **Animation**: restrained — slow alarm pulse 1 Hz, smooth 200-300 ms cross-fade, parallel-stroke laser flow only on energised lines. Forbidden: bounce, spring, decorative particles, rainbow.
- **Typography**: JetBrains Mono for numeric instrumentation; IBM Plex Sans/Mono for labels and operator text. Inter is retired from this cockpit contract.

## Standards referenced (22 codes)

ISA-5.1 / IEC 60617 / IEEE C37.2 / IEEE 1584 / NFPA 70E / IEC 60364-5-54 / IEEE 519 / IEC 60076 / IEC 62040-3 / ISO 8528 / ASHRAE TC 9.9 (W3-W5) / ASHRAE 90.4 / NFPA 72 / NFPA 2001 / NFPA 75 / NFPA 76 / TIA-942 / Uptime Institute Tier / IEC 62443 / BACnet / Modbus / IEC 61850 / IEEE 1588 PTP / ISO 50001

## Symbol library checklist

~50 SVG symbols to assemble across 4 categories: Mechanical (ISA-5.1), Electrical (IEC 60617), Fire & Safety, BMS / IT. See full checklist in the audit MD § 4.

## LDC-layer addition spec (the user's primary call-out)

Insert a new "L2 — Supervisory" swim-lane between L1 Controller and L3 Operations on the BMS Architecture page, containing 5 LDC nodes:

- `LDC-01-CHILLER` — Schneider Magelis GTU 12" at chiller plant (Profinet to PLC)
- `LDC-02-EHOUSE-A` — Siemens KTP1500 in MV switch-room A (IEC 61850 MMS)
- `LDC-03-EHOUSE-B` — mirror of LDC-02 in switch-room B (redundant operator station)
- `LDC-04-NOC` — Wonderware InTouch SE main console (OPC UA read-only on critical loops)
- `LDC-05-BMS-RM` — AVEVA System Platform engineering ws (LOTO permit gateway)

All LDC traffic transits through unidirectional gateway (data diode) to L3 historian, per IEC 62443.

## Related

- [[DataHall-AI]] — the page being audited
- [[Standards-Hub]] — TIA-942, Tier ratings, ASHRAE thermal classes
- [[../05-Standards/Standards-Hub#fire|Fire pillar]]
- [[../00-Hub/Site-Architecture]]

## Maintainer notes

- DO NOT push the underlying audit file or its `SS 010526/` screenshots folder to the repo. The whole `Automation/` directory is gitignored.
- This vault entry is safe to push (no sensitive content).
- Re-read the audit MD before any iteration on `datahallAI.html`.
- Per [[../00-Hub/README#Graphify Protocol]]: when querying via Graphify, the audit MD is the single-source-of-truth for what to fix on the BMS page. Don't re-crawl the source HTML.

## v1.130.0 evidence milestone

- Alarm query/first-out, evaluated electrical scenarios, zoned FACP cause-and-effect, and rack-density reference comparisons now have pure data contracts plus regression tests.
- The approved monolithic diagrams were preserved; new semantic state is projected onto them instead of using CSS color as operational truth.
- The four-second electrical renderer is now isolated in `electrical-live.js`: post-tick IT/facility/PUE values remain 3.564 MW / 4.638 MW / 1.30 per hall, and per-unit generator state follows the selected semantic scenario instead of random telemetry. Successful transfer is explicitly 7 RUNNING + 1 STANDBY; normal is 0 RUNNING + 8 STANDBY; failed start reports 8 FAILED. Renderer errors invalidate every owned field rather than leaving stale live-looking values.
- Current cooling inventory is reconciled to 9 running / 12 installed 350 kW CDUs per hall (48 installed facility-wide); selected-hall heat and TCS flow bind to 3,029 kW and 4,342 LPM. Legacy 24-CDU and 22-pump operational labels are regression-forbidden.
- GB200 Scenario A remains adopted. GB300 142 kW/rack remains a comparison study only.
- New follow-on UI work must preserve the module/test boundary in `js/datahall-ai/` and the no-global-shutdown/FACP-authority rules.
- Full-site dark verification keeps strict product semantics: a sweep candidate needs two normal-timing clean confirmations in separate fresh Chromium processes; reproduced findings, incomplete confirmation, or render errors fail closed.
- Theme sampling forces style recalculation and waits for two rendered frames before the transition interval; host wall-clock time cannot substitute for proof that the palette was actually painted.

## v1.134.14 operator-chrome and authority milestone

- The simulated provenance instrument is now compact, instrument-cyan and contained in the
  header; the page no longer claims live telemetry.
- Header actions and primary navigation own separate horizontal rails. The remaining cockpit
  height is calculated by flex layout rather than a fixed 80 px assumption, so 1440 and 390 px
  views retain reachable main/sidebar scrollports without menu overlap.
- The dashboard/engineering geometry and semantic modules remain intact; the regression gate
  tests header/tab separation, horizontal overflow and vertical reachability.
- Current-value UI and generated-document language says `SIMULATED` / deterministic display
  refresh; `live` or `real-time` is retained only for clearly labeled future design capability.
- Missing, legacy, request-mismatch and same-version-incomplete datahall model/calculation bundles
  keep the cockpit inert and `UNAVAILABLE`, including BOD, Generate Design, FAQ and hidden drawers.

## v1.134.15 truthful-first-paint milestone

- Engine KPIs no longer count through plausible false values. PUE 1.30, WUE 0.00, CUE 0.90,
  IT 14.26 MW, 7,776 GPUs and 108 NVL72 domains are exact from the first rendered frame.
- Mobile telemetry starts as a compact 60 px spine and expands through an unobscured 40 px control;
  its preference is independent from desktop.
- The BoD drawer owns the foreground and wraps all values and evidence sources at 390 px. Floating
  public links cannot obscure its title or actions.
- Cockpit/auth chrome is flat and semantic: no grid/scanline decoration, purple gradient, glow or
  neon selection fill. Fresh dark/light desktop/mobile audits report no viewport overflow or errors.
- The AI route exposes the exact `data-rz-cockpit-root="dc-ai"` identity. Audit authorization removes
  only exact login/restriction overlays, preserves engineering dialogs, and exits non-zero after saving
  any wrong-root, error or missing-capture evidence.
