# PRD-CONV-BMS-DECLUTTER — less text, nothing said twice (owner R185)

Status: BUILT v3.87.0 (gate tools/test-conv-declutter.mjs; 12 of 33 checks red on v3.86.1)
Owner comment (2026-11-22, after v3.86.1): "Sepertinya masih ada tulisan2 yg tidak perlu atau duplicate masih over."

## 1. Measured state (v3.86.1, 1440 × 900, first screen, words outside the drawing; tools/audit-conv-text.mjs)

| page | words | what repeats |
|---|---|---|
| chiller-plant | 239 | CHWS/CHWR/ΔT/flow/duty in the alarm strip AND the Primary CHW header panel; a second line-style legend above the sheet's own legend; "READ-ONLY PLANNING BASIS · not connected …" |
| fuel-system | 201 | tag line under the title; a formula line under each KPI restating the KPIs beside it ("744,144 L ÷ 15503 L/hr") |
| water-system | 249 | Instant WUE in the KPI band AND the WUE panel; 600 L/min in the KPI band AND the basis card; formula lines under KPIs |
| fire-system | 160 | "Basis: IT 30.00 MW · 2,000 racks" above the CURRENT card that says the same |
| ict | 154 | — |
| EPMS_Telemetry | 192 | open-breaker count in the strip AND the single-line rail |

On every sheet page "Simulated" was shown three times: the telemetry banner, the strip's scenario reading and a
provenance sentence under the strip ("Simulated · conv-engine.js scenario; data quality = the model's own flag; …").

## 2. Rule

At rest a page shows the drawing, numbers, one-word labels and states (owner rule 2026-11-12, "less visible text,
tooltips"). An explanation, a formula or a qualifier goes into the tooltip of the thing it explains. A reading is
shown once per screen. Provenance stays honest: "Simulated" stays visible (the banner), the full basis sentence stays
in the DOM for `aria-describedby` and the provenance gate (PRD-Q06), and is the tooltip of its strip.

## 3. Mechanism

- `js/conv/quiet.js`: an element marked `[data-quiet]` (value: selector of its host, or empty for the parent) is not
  shown (`css/conv-live.css`) and its text becomes a line of the host's `title`. When a script rewrites it, a
  MutationObserver replaces that line, so a live formula or limit stays current in the tooltip.
- `[data-dup="<id>"]` marks the second copy of a reading; it is not shown and the copy named by the id stays.

## 4. Laws (gate `tools/test-conv-declutter.mjs`)

- DC1 first-screen words outside the drawing ≤ budget: chiller 200, fuel 160, water 200, fire 145, ict 140, EPMS 180,
  datahall 310 (already decluttered in PRD-CONV-DATAHALL-SPACE).
- DC2 the strip provenance line is not shown, keeps its text, sits in a tooltip; "Simulated" is still shown.
- DC3 every quiet element is not shown and its text is in its host's tooltip.
- DC4 every duplicate is not shown and the reading it names is shown.
- DC5 a rewrite of a quiet element updates the tooltip (water WUE target).

Result: chiller 239 → 194, fuel 201 → 151, water 249 → 197, fire 160 → 137, ict 154 → 134, EPMS 192 → 169.

## 5. Kept on purpose

- The telemetry banner row: it is the one place that turns into COMMS LOST, and its layout is guarded by
  `test-conv-alarm-runtime` (own slot, 44 px dismiss target).
- Fire "36 m³ short of 60 min …": a design finding that must not be edited away (fire-system.html comment).
- EPMS "SIMULATION Select a breaker …": the status line that reports each switching result.
- Datahall readings that look alike (rack-inlet target vs inlet average) are different quantities.
