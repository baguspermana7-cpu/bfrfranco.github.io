# PRD — datahallAI HMI sheets as an operator BMS (owner brief "BMS_UIUX_Master_Prompt", 2026-11-15)

Scope: the HMI sheets of `datahallAI.html` (renderer `js/rz-hmi-sheet.js`, sheets `js/datahall-ai/hmi-sheets.js`,
binding `js/datahall-ai/hmi-v2.js`, payloads `js/datahall-ai/hmi-payloads.js`). Data is simulated (engine design basis +
`sim-telemetry.js`, peer-owned) or replayed (P05 `setProvider` seam). No point is ever written; there is no live plant.

## 0. What the code does today (measured 2026-11-15)

| Finding | Where | Effect on the operator |
|---|---|---|
| F1 every line animates "running" forever | `hmi-v2.js` mounts sheets without `opts.flow`; `rz-hmi-sheet.js` sets `data-flow="running"` at render | flow shown with no evidence, also when data is stale or a pump is stopped |
| F2 states guessed without evidence | `hmi-v2.js stateOf`: every breaker `closed`, valve `open`, transformer `energized`, anything without a payload `running` | a breaker or valve the model knows nothing about looks healthy |
| F3 no quality on sheet values | `read()` returns text only; `quality` (`simulated` / `replay` / `missing`) is dropped | operator cannot tell a valid zero from no sample |
| F4 alarm shown by colour only | CSS `data-alarm` hue + glow | invisible in greyscale; no acknowledged state |
| F5 command vs feedback not shown | pump nodes show one state | a pump commanded ON with no feedback reads like a running pump |

## 1. Laws (each a gate assertion; each proven red on the current tree first)

| Law | Check |
|---|---|
| O1 one state model | sheet node `data-state` equals the inspector state for the same payload, on every sheet node with a payload |
| O2 no state without evidence | a node with no payload and no topology evidence renders `data-state="na"` (neutral, not instrumented) — never `running` / `open` / `closed` / `energized` |
| O3 flow only with evidence | an edge animates (`data-flow="running"`) only when its driving equipment (`flowOf`, or the pump / feeder upstream on the same medium) is `running` with good quality; `stopped` → no motion; stale / missing → `unknown`, no motion, dashed |
| O4 quality on values | every value shows its quality: valid, `no sample` (—, hollow marker), `stale` (last value + age + marker), `replay`; a valid 0 prints `0`, never `—` |
| O5 alarm without colour | an alarmed node carries a shape marker (priority badge) that survives `filter: grayscale(1)`; acknowledged = hollow badge; active stays visible until the source clears |
| O6 command vs feedback | pumps and fans print CMD and FB; a mismatch is a P2 marker and the motor symbol does not spin |
| O7 electrical honesty | breaker position from the electrical scenario engine; energized only with source reach; 0 kW prints as `0 kW` on a closed, energized feeder |
| O8 reduced motion | `prefers-reduced-motion: reduce` → no dash march; static arrows only where the direction is known |
| O9 responsive | sheets fit and stay operable at 360, 768, 1440, 1920 px and at 200 % browser zoom (1440 / 2); hit targets ≥ 24 px at 390 px |
| O10 inspector keeps context | closing the inspector / a modal restores the selected node, pan and zoom of the sheet |
| O11 performance | p95 frame interval ≤ 20 ms desktop / ≤ 34 ms mobile emulation over 30 s pan + zoom with telemetry ticking; alarm-to-marker latency measured |
| O12 scenarios | the seven scenarios of the brief §7, run through fixtures / replay, each with its pass evidence (table §3) |

## 2. Phases

| Phase | Scope | Gate |
|---|---|---|
| P1 | O1 O2 O3 O4 O5 O8 in `hmi-v2` + renderer + CSS; flow derivation per edge; quality markers; alarm badge | `tools/test-dh-operator.mjs` laws O1–O5, O8 (red first on 8fdf0a429) |
| P2 | O6 O7 (CMD/FB rows from payloads, electrical scenario states on sheets) | same gate O6, O7 |
| P3 | O9 O10 | same gate O9, O10 |
| P4 | O11 O12 + profiling record | same gate O11, O12; numbers in §4 |

## 3. Scenario mapping (brief §7)

| Brief scenario | Fixture here | Pass evidence |
|---|---|---|
| pump CMD ON, FB OFF, flow 0 | cooling scenario `cdu-pump-fail` (pump 1 failed) | P-xxA `data-state=fault`, its edges `data-flow` ≠ running, badge present in greyscale |
| ΔT from supply / return, return loses quality | replay provider returns `missing` for the return point | ΔT row marked derived-from-missing, value `—` with marker |
| signed flow + → 0 → − | not modelled (no signed flow point in the engine) | recorded as **not applicable**; arrows only on known direction (O8) |
| breaker closed, no voltage, 0 kW | electrical scenario with an upstream source lost | breaker `closed`, feeder not energized, `0 kW` printed |
| one point stale, asset alarm active | replay provider: one point `missing` while scenario keeps the alarm | only that value marked; alarm badge stays |
| trip with inspector open, then ack | `chiller-trip` + alarm workspace ack | node findable (badge), stays active-acknowledged while the source is active |
| phone / reduced motion / renderer failure | 390 px + `prefers-reduced-motion` + `RZHmiSheet` throwing | sheet or fallback list shows state, values, quality; no motion |

## 3b. Status (2026-11-15)

| Law | Status | Evidence |
|---|---|---|
| O1 O2 O3 O4 O5 O8 | done (P1) | `tools/test-dh-operator.mjs` 12/12; 9/12 red on 8fdf0a429 |
| O7 | done (P2) | same gate O7a–d 4/4; 3/4 red on c2072c3fa (O7c already held through the payload chip) |
| O6 | **not verifiable — no source**: the engine and payloads publish pump state and speed but no command point; nothing is invented. When a command point exists the pump value prints CMD / FB and a mismatch raises P2 |
| O9 O10 | done (P3) | gate O9 at 360 / 768 / 1440 / 1920 / 1440@200 % + finder on 360 (tap 29 px), O10 modal open / close keeps view + selection; red on 0f8b2c26b (no finder) |
| O11 | measured, **target not met** (§4) | gate O11 reported; strict with `--perf-strict` |
| O12 | partly: scenarios 1, 4, 5, 6 covered by O3b / O7 / O4b / O5; 2 (ΔT with lost return) and 3 (signed flow) **not applicable** — no ΔT row tied to a return-sample quality, no signed flow point in the engine | — |

## 4. Measurements (2026-11-15, this laptop: AMD Ryzen + Radeon Vega 10, Chrome headless 1440 / 390 px)

Sheet: DH-A-101 Room Layout (599 items, 2,458 SVG elements), 30 s continuous zoom in / out every 50 ms, sheet repaint every
1 s (4x the page's 4 s tick). `RZ_GPU=1 node tools/test-dh-operator.mjs`.

| Measure | Before | After (P4) | Target | Verdict |
|---|---|---|---|---|
| repaint of DH-A-101 (`update()`) | 2,198–3,244 ms | 6 ms | — | fixed: the payload context (whole electrical topology) was rebuilt per node; now once per tick / scenario |
| frames in 30 s, desktop software raster | 44 | 1,048 | — | — |
| median frame, desktop GPU | 33 ms (software) | 16.7 ms | — | 60 fps |
| p95 frame, desktop GPU | 2,133 ms (software) | 50 ms | ≤ 20 ms | **not met** |
| p95 frame, 390 px + 4x CPU, GPU | 9,050 ms (software) | 300 ms | ≤ 34 ms | **not met — not verifiable here**: emulation throttles the compositor's CPU work too; needs a real phone |
| alarm source → badge on the sheet | 698 ms desktop / 3,378 ms mobile | 174 ms / 546 ms | — | repaint on the source event instead of the 4 s poll |

Changes behind it: payload context memoised per (tick, scenarios, replay); element lookups cached, attributes written only on
change; zoom / pan move the drawn sheet by a GPU transform and commit the viewBox (sharp text, LOD, shading) 180 ms after
the view settles; shading dropped while moving. Remaining p95 cost: the re-raster at each settle and the per-second repaint
of a 2,458-element SVG — next step is a level of detail that skips rack slots and name text below zoom 1.6.
