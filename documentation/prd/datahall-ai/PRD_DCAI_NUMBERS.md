# PRD-DCAI-NUMBERS — every number has a colour, a history, and a home in the database; the Data Hall tab polished

Status: **APPROVED by the owner 2026-11-21** (ExitPlanMode). B0 = v3.81.0. B1 built 2026-11-21: `js/datahall-ai/points.js` (61 records, 51 banded: 6 standard, 2 design, 43 assumed) + `tools/test-dcai-points.mjs` (833 checks; a warn limit moved below the setpoint fails 27). Not yet loaded by the page: B2 binds it.
owner already said "Rilis A1 sekarang".
On approval this file is committed as `documentation/prd/datahall-ai/PRD_DCAI_NUMBERS.md`. It extends the approved
PRD-DCAI-LIVING-PLANT and folds in its phases A3 (Data Hall) and A4 (trend).

## 0. Context: the owner's words (2026-11-20, R178–R180)

| id | comment | answered in |
|---|---|---|
| N1 | "Parameter angka yg normal kasih warna hijau … temp tcs 35 °C terus warna kuning saat 37 °C atau merah" | §3, phase B2 |
| N2 | "semua angka juga saat di klik bisa keluar modal trendline dan ada tombol 1d, 7d dsb yg sangat intuitive" | §5, phase B4 |
| N3 | "uiux datahall nya itu sangat perlu di refine dan di polish more" | §6, phase B5 |
| N4 | "Angka2 itu harus dimasukkan database" | §4, phase B3 |
| — | "Rancang planning dan prdnya secara comprehensive baru eksekusi" | this document |

Owner decisions taken 2026-11-20 (AskUserQuestion):
- Bands are **relative to the design setpoint**, with a source per point.
- The database is **Supabase, with an Edge Function called every minute by pg_cron**.
- The trend ranges are **1h · 8h · 1d · 7d · 30d**.
- **A1 ships now.**

## 1. Where the page is today (measured on 2bc05a8b5 + branch dcai-a1)

| fact | evidence |
|---|---|
| **No point carries a normal / warning / alarm limit.** A simulated row has a noise amplitude (`band`), not a limit. A colour today is a hard-coded hue per tile: PUE and IT are amber, ΔT and DLC are cyan, UP is green. These colours carry no meaning. | `hmi-payloads.js:126-140` (`Builder.S`), `datahallAI.html:1151-1161` (`style="color:var(--o)"`) |
| The owner's example does not fit the design: the engine sets **TCS supply 40 °C / return 50 °C** (planes p07 / p08). With 35 / 37 bands the normal plant would always show red. | `dcai-engine.js:123-124`, sidebar "TCS Sup 40.0 °C" |
| **Trend:** `js/rz-trend.js` (RZTrend, from the Conventional session, v3.67) already does pens, multitrend, cursor, CSV and limits (`hi`/`lo`). Its ranges are 5m / 1h / 8h / 24h / 7d. Its history is `js/conv/history.js`, deterministic and simulated. The DC AI page does not load either module. A number on a sheet cannot be clicked: `readNow` drops the point id. | `rz-trend.js:5-21`, `hmi-v2.js` readNow |
| **Database:** Supabase is already used (profiles, audit_log, feature_overrides …). It has no telemetry table and no scheduled writer. One Edge Function already exists (`supabase/functions/admin-users`). | `supabase/schema.sql`, `supabase/functions/` |
| **Data Hall tab, 1440 and 390 px, both themes:** | screenshots `$S/hall/*.png` |
| – the 9 KPI tiles at 390 px stack as 9 full-width cards (~600 px) before the plan | hall-dark-390 |
| – the hall selector breaks "DH-" / "1" over two lines, and DH-7 and DH-8 are cut off | hall-*-390 |
| – the status strip says "CRITICAL" and "Critical 1" side by side | all |
| – two prose lines (FLOOR …, CLOSES …) and a 25-word title sit above the plan; the owner's rule is less visible text, more tooltips | 1440 |
| – 60 aisle temperatures are rotated text with no name, no unit legend and no tooltip (C2, still open) | 1440 |
| – in light theme the sidebar title "Datahall-1" is faded grey, and the plan sits on a cyan wash | hall-light-* |
| – the plan has no airflow motion (cold aisle, hot plume), as in PRD-LIVING-PLANT E4–E6 | 1440 |
| Point count (sizing): 105 simulated + 127 engine + 20 plane rows over 61 classes. The historian keeps a chosen set (§4.2), not every row of every instance. | grep on `hmi-payloads.js` |

## 2. Goal and laws

A reader sees at a glance which number is normal, which needs attention and which is in alarm. One tap on any
number shows its history from the database, with time ranges a person understands without reading a manual.

- **L-N1 Colour = band, never decoration.** A number is coloured only by its band (normal · warning · alarm · no
  band), and every band also has a second signal (glyph + word in the tooltip).
- **L-N2 Every number is a point.** Anything drawn as a value has a point id, a unit and a basis, and opens its
  trend on click, Enter or T.
- **L-N3 The historian is the source of the trend.** The modal reads the database. If the database cannot be
  reached, it says so and falls back to the local simulated history, labelled as such.
- **L-N4 Simulated stays labelled.** Every row in the database carries `quality = 'sim'`. The page never calls a
  number "measured".

## 3. Bands (N1): one registry, relative to the setpoint, with sources

### 3.1 Point registry
New `js/datahall-ai/points.js` (UMD, Node-tested; `window.RZDatahallAIPoints`). One record per point class:
```
{ id: 'cdu:tcs_supply_c', label: 'TCS supply', unit: '°C', setpoint: 'design.planes.p07_tcs_supply_c',
  band: { kind: 'high', warn: +1.0, alarm: +3.0 },        // relative to the setpoint, in the unit
  source: 'ASHRAE TC9.9 W45 class + NVIDIA GB300 cold-plate inlet limit 45 °C', history: true }
```
- Band kinds: `high` (alarm above), `low` (alarm below), `window` (both sides), `none` (a count, a nameplate, or a
  design figure: no colour).
- `band(pointId, value, snapshot)` → `normal | warning | alarm | none`. This is a pure function. The limits follow
  the engine: change the design TCS supply and the bands move with it.
- The renderer and `rz-trend.js` read the limits from here (trend lines `hi`/`lo`). The sim alarm list
  (`alarm-query.js`) is checked against them (law N1d).

### 3.2 Proposed table: shown to the owner as a table before B2 ships
| point | setpoint (engine) | warning | alarm | source |
|---|---|---|---|---|
| TCS supply | 40 °C (p07) | > 41 | > 43 | ASHRAE W45 (≤ 45), NVIDIA GB300 inlet |
| TCS return | 50 °C (p08) | > 51 | > 53 | design ΔT 10 K |
| TCS ΔT | 10 K | < 8 or > 12 | < 6 or > 14 | CDU design ΔT |
| HTW supply / return | 37 / 45 °C (p05/p06) | ±1.5 | ±3 | approach of the plate HX |
| Cold aisle / rack inlet | 25 °C (p09/p10) | > 27 | > 32 | ASHRAE A1 recommended 27, allowable 32 |
| Hot aisle | 36 °C (p11) | > 40 | > 45 | containment design |
| CDU flow | design L/min | < 90 % | < 80 % | flow-low alarm (alarm list FX-003) |
| CDU ΔP, pump current, vibration | design value | ±15 % | ±30 % (vibration: ISO 10816 zones B/C) | ISO 10816, nameplate |
| PUE | design 1.17 | > 1.25 | > 1.35 | site design target |
| UPS load | design % | > 80 % | > 90 % | N+1 / 2N loading rule |
| Leak, EPO, VESDA | state | — | wet / operated / fire | C&E |
Each row cites its source in the registry. A row whose source cannot be found gets kind `none`; a band is never
invented. The full table, about 60 rows, is produced in B1 and sent to the owner.

### 3.3 How a band looks
- **Normal:** low-chroma green (`--vfx-run`), plain value.
- **Warning:** amber (`--vfx-warn`) plus a ▲ glyph before the value.
- **Alarm:** red (`--vfx-alarm`) plus a ◆ glyph. The value cell reads in greyscale too.
- **No band:** the neutral text colour.
- The same tokens as the line states (one grammar, `css/conv-vfx.css`). Contrast ≥ 4.5 : 1 in both themes.
- Applies to: the Data Hall KPI strip, the hall cards, the sidebar, values on every DH sheet, inspector rows, and
  the trend's last value. The decorative inline colours on the KPI tiles go.

## 4. Historian (N4): Supabase, filled every minute

### 4.1 Schema (`supabase/migrations/2026-11-2x-dcai-historian.sql`)
- `dcai_points(id text pk, label, unit, class, hall int, band jsonb, source text, created_at)`: written from the
  registry.
- `dcai_samples(point_id text, ts timestamptz, v double precision, quality text default 'sim', primary key (point_id, ts))`:
  raw values at 1-minute steps, kept 24 h.
- `dcai_rollup_15m(point_id, ts, v_min, v_avg, v_max, n, primary key (point_id, ts))`: kept 30 days.
- **RLS:** read for `anon` + `authenticated`, because the data is simulated and holds no personal data. **No
  insert, update or delete policy:** only the service role (the Edge Function) writes.
- `pg_cron` jobs:
  - every minute, call the function (`net.http_post`);
  - every 15 minutes, roll up;
  - hourly, delete raw rows older than 24 h and rollups older than 30 days.

### 4.2 What is stored (the historian set)
- Hall 1 in full detail: every CDU (supply, return, flow, ΔP, pump rpm, current), every row (inlet, hot aisle),
  the fan walls (speed), the HTW and CDW stations, and the hall KPIs (PUE, IT, DLC, ΔT, UPS A/B load).
- Halls 2–8: KPIs only.
- ≈ 520 points. Size:
  - 24 h raw: 520 × 1,440 = 0.75 M rows;
  - 30 d rollup: 520 × 2,880 = 1.5 M rows;
  - ≈ 160–200 MB with indexes, inside the free tier (500 MB).
- The gate prints the measured size (law H5).

### 4.3 Writer: Edge Function `dcai-sample` (Deno)
- It runs **the same code** as the page: `js/dcai-engine.js`, `js/datahall-ai/sim-telemetry.js` and
  `hmi-payloads.js` (UMD), imported by the function, with no second copy. A Node test proves that the function and
  the page give the same value for the same (point, minute) (law H2).
- On each call it computes the current minute for every point in the historian set and does one batched upsert.
- If a minute is missed (cron or quota), the trend shows a gap. A gap is never filled with invented values.
- **Live value = database value.** The page reads the latest sample, so a number on the page and the last point of
  its trend are equal (law T8). For the 4 s live tick between minutes, the page keeps its local simulator and labels
  it as "live (sim)"; the modal shows where the database data ends.

### 4.4 Owner actions (one time)
Deploying needs the Supabase CLI to be signed in to the project. The CLI and its token are not on this machine
(to be checked in B3). If they are missing, the owner runs `! npx supabase login` and
`! npx supabase link --project-ref <ref>` once. I never type or print a key. The service-role key stays in Supabase
secrets.

## 5. Trend modal (N2): one tap, ranges anyone understands

- **Reuse `js/rz-trend.js`.** No second modal. The DC AI page loads it with an additive **provider** option:
  `RZTrend.register(points, { provider })`, where provider = `series(id, fromMs, toMs, stepMin)` that returns a
  Promise.
  - The DC AI provider reads `dcai_samples` (1h · 8h · 1d) or `dcai_rollup_15m` (7d · 30d, drawn as a min–max band
    plus the average).
  - Without a provider, rz-trend keeps `RZConvHistory`, so the Conventional pages are unchanged.
- **Ranges: `1h · 8h · 1d · 7d · 30d`**, a segmented control at the top, default **1d**.
  - The Conventional session must agree to the shared label change (24h → 1d; 5m kept for them via an option).
  - Additive, coordinated before the release (§8).
- **Intuitive by construction:**
  - The title is the point name and its tag. The big current value is in its band colour.
  - The warning and alarm limits are drawn as dashed lines with their numbers. The setpoint is a thin line.
  - Hovering or dragging moves a cursor that shows time and value.
  - Min / avg / max for the range, and the time spent above the warning limit.
  - "Add series" to compare, up to 8 pens (exists).
  - CSV export (exists). A "Basis" button opens the existing basis record, so the number's basis is one tap
    further, not lost.
  - A "SIM" badge. Loading shows a skeleton line, not a spinner. A database error shows one sentence and a retry.
- **Every number opens it:**
  - `readNow` keeps the payload row's `point`, and the value text gets `data-trend="<class>:<id>:<hall>/<point>"`.
  - The KPI strip, hall cards, sidebar, inspector rows and the new sensor chips get the same attribute.
  - Click, Enter or T opens the trend.
  - Today's click-to-basis on a hooked number moves into the modal's "Basis" button. One action per tap, as the
    owner asked.
- **Phone:** the modal is a full-height sheet (`js/rz-sheet.js` behaviour), range buttons ≥ 44 px, the plot fills
  the width, and the cursor follows the finger.

## 6. Data Hall polish (N3, plus LIVING-PLANT A3)

Each item has a law, and each is checked on screenshots at 1440 and 390 px, in both themes. A `hallmark audit` and
an `impeccable` critique run before and after.

| # | change | law |
|---|---|---|
| D1 | KPI strip: values coloured by band (§3), decorative hues removed. At 390 px it becomes a 3-column compact grid (≤ 3 rows, ≤ 200 px); no 9 stacked cards | DH1: strip height at 390 ≤ 200 px; 0 inline colours |
| D2 | Hall selector: one line per chip ("DH-1"), horizontal scroll with an edge fade at 390 px, active chip scrolled into view | DH2: no chip wraps; all 8 reachable |
| D3 | Status strip: one severity summary, no duplicated "CRITICAL" + "Critical 1"; each count opens the Alarms tab filtered | DH3: one alarm summary element |
| D4 | Text: the 25-word title becomes "DH-01 · 440 racks · 67.4 MW IT"; the FLOOR / CLOSES lines move into a tooltip ("Area check") | DH4: ≤ 12 words of prose above the plan |
| D5 | The three path cards (IT / liquid / air) keep their numbers, banded and clickable; the sentences become tooltips | P1-style hover test |
| D6 | The 60 rotated aisle temperatures become named sensor chips (`TT-CA-03-2 25.6 °C`), horizontal, with band colour and a click to trend; humidity chips added. A legend row with units: row tag · rack count · row kW · aisle supply / return · CDU range | DH6: 0 rotated value text; every value has a name + unit + trend |
| D7 | Airflow motion bound to state (LIVING-PLANT E4/E5/E7): cold-aisle streamlines from each duty fan-wall module, the hot-aisle plume rising to the plenum (tint = aisle temperature), the row-manifold gradient. Same clock, off-screen pause and reduced-motion rules as A1 | V1–V3 extended to the hall plan |
| D8 | Section view (E6) beside the plan: fan wall → cold aisle → rack → hot aisle → plenum → back | DH8: drawn, bound to the same points |
| D9 | Light theme: sidebar title at ≥ 4.5 : 1, the plan background on the neutral register (no cyan wash) | contrast gate on both themes |
| D10 | 390 px: the plan fits the width with pan / zoom, and the sticky hall bar at the bottom never covers content (padding = its height) | DH10: no overlap, no horizontal scroll |
| D11 | Tooltip on every hall item (the Data Hall handler today is mouse-only): hover, focus and tap, the rack shows the rack, not its row (LIVING-PLANT §6) | P1 |

## 7. Phases (each phase is its own release: laws red, then green, then screenshots, ship gate, push, live check, pictures to the owner)

| phase | content |
|---|---|
| **B0** | Ship A1 as v3.81.0, already built and proven: test-dh-vfx 80/0 (red 45/76), test-dh-drawings all passed, test-dh-operator exit 0. Then ship gate, push, live check, screenshots. |
| **B1** | `points.js` registry and the band table (~60 rows with sources). Sent to the owner as a table. Node gate `test-dcai-points.mjs`: every source present, band monotonic, and the design point evaluates as normal. |
| **B2** | Band colours on every number (§3.3), decorative colours removed. Gate `test-dh-bands.mjs`: perturb a value through the sim seam, and the colour, glyph and tooltip change. |
| **B3** | Historian: migration, RLS, Edge Function, pg_cron, retention. Node parity test; a live check that rows arrive every minute and that anon cannot insert. |
| **B4** | Trend: the rz-trend provider option, ranges 1h–30d, every number clickable (§5). Coordinated with the Conventional session. |
| **B5** | Data Hall polish D1–D11 (folds LIVING-PLANT A3). |
Then LIVING-PLANT A2 onward continues (modal shell, network drawings, …).

## 8. Working with the Conventional session (update 2026-11-20: their message)
The Conventional session is building **PRD-CONV-POINT-STATUS-TREND T1**:
- `js/rz-trend.js` 2.0.0, with ranges 1H / 8H / 1D / 7D / 30D, default 1D. Old 24h maps to 1D, old 5m to 1H, and
  the API is unchanged.
- new `js/conv/point-status.js` + `css/conv-point.css`, a status colour per number;
- `history.js` additive;
- `rz-sheet.js` onClose.

This is the same ground as my B2 and B4. **One implementation, theirs:**
- **B2** renders the bands through `point-status.js`, once it ships. My part is only the DC AI registry
  (`points.js`: setpoints from the engine + sources) and binding every DC AI number to it. If their API cannot take
  setpoint-relative limits, I propose an additive field, and I never fork the module.
- **B4** uses rz-trend 2.0.0 as is, so the ranges and the 1D default come from them. My part:
  - the DC AI **provider** (historian), proposed as one additive option `register(points, { provider })`;
  - `data-trend` on every DC AI number;
  - the Basis button.
- **Order:** B4 starts after their T1 is live. B2 starts after `point-status.js` is live, or uses the registry
  alone if T1 slips (decided at B1).
- Their gates (`test-conv-vfx-trend`, `test-conv-vfx-sheets`, and the point-status gate) run before my push. The
  proposal for the provider option is sent to them now, before they freeze 2.0.0.
- `points.js` band kinds and the historian schema are written so their pages can use them later. Their adoption is
  their call.

## 9. Laws (each red on today's tree before it is trusted)
| law | claim | red today |
|---|---|---|
| N1a | every number drawn on the Data Hall tab and the DH sheets has `data-band` from the registry; 0 inline decorative colours | 9 inline colours, 0 bands |
| N1b | a value moved past its warning / alarm limit through the sim seam changes colour + glyph; back inside → normal | no bands |
| N1c | the design point of every banded point evaluates `normal` (no red plant at design) | — (guards the 35/37 trap) |
| N1d | every alarm in the sim alarm list sits outside its point's band | — |
| N2a | every value element has `data-trend`; click, Enter and T open the modal with that point | sheet values not clickable |
| N2b | ranges 1h · 8h · 1d · 7d · 30d, default 1d, buttons ≥ 44 px on a phone, Esc returns focus | 5m/1h/8h/24h/7d, not loaded |
| T8 | the trend's last value equals the number clicked (same minute) | — |
| H1 | rows arrive every minute (3 consecutive minutes seen live); quality = 'sim' on every row | no table |
| H2 | Edge Function value = page value for the same (point, minute) on 50 sampled points | — |
| H3 | anon insert / update / delete is refused; anon select works | — |
| H4 | the DB unreachable (blocked in the browser) → modal says so and shows the local SIM history, labelled | — |
| H5 | storage after 24 h ≤ the §4.2 estimate + 25 %; retention removes old rows | — |
| DH1–DH10 | §6 | see screenshots |
| existing | test-dh-vfx, test-dh-drawings, test-dh-operator, test-conv-vfx-*, test-site-chrome, ship gate | — |

## 10. Risks
- **Supabase free tier** pauses after a week without traffic. The writer keeps it active. The quota (500 MB) is
  watched by H5. Edge Function calls: 43 k/month, under the free 500 k.
- **Bundling the page code into Deno:** the modules are UMD and run in Node today. If one touches `window`, it is
  wrapped, never forked (H2 catches drift).
- **Band table accuracy:** every row cites its source, and a missing source means no band. The owner sees the table
  before any colour ships.
- **The shared trend modal:** a change on their pages is coordinated and their gates run before my push.
- **The cdu-pump-fail finding** (pump 1 faults on every CDU, while the alarm list names CDU-04) is fixed in B2:
  the scenario faults CDU-04 only, matching its alarm.

## 11. Verification
For each phase:
- its laws quoted red, then green;
- `node tools/test-dh-vfx.mjs`, `test-dh-drawings`, `test-dh-operator`, the new gates;
- `tools/ship-gate.sh`, pushed;
- on resistancezero.com: open the Data Hall and Cooling tabs at 1440 and 390 px in both themes, click a TCS supply
  number, switch 1h → 7d → 30d, perturb a scenario and watch the band change;
- screenshots looked at and sent to the owner. For B3, also a SQL count of rows per minute from the live database.

## Appendix B1 — band table (generated: `node tools/test-dcai-points.mjs --table`)

Evidence: standard = a published limit; design = an engine or page design figure; assumed = a declared training setting, shown as "limits ASSUMED". "no band" = the value is shown without a colour.

| point | unit | setpoint | warning | alarm | evidence | source |
|---|---|---|---|---|---|---|
| TCS supply (`cdu/tcs_supply_c`) | °C | 40 | > 41 | > 43 | assumed | declared training setting: +1 K warning, +3 K alarm above the engine setpoint; ceiling ASHRAE TC9.9 liquid-cooling class W45 (facility water ≤ 45 °C) |
| TCS return (`cdu/tcs_return_c`) | °C | 50 | > 51 | > 53 | assumed | declared training setting: +1 K warning, +3 K alarm above the engine setpoint; ceiling ASHRAE TC9.9 liquid-cooling class W45 (facility water ≤ 45 °C) |
| HTW supply (`cdu/htw_supply_c`) | °C | 37 | < 35.5 or > 38.5 | < 34 or > 40 | assumed | declared training setting: ±1.5 K / ±3 K around the engine setpoint (plate-HX approach) |
| HTW return (`cdu/htw_return_c`) | °C | 45 | > 46.5 | > 48 | assumed | declared training setting: ±1.5 K / ±3 K around the engine setpoint (plate-HX approach) |
| Pump current (`cdu/pump_amps`) | A | 42 | > 46.2 | > 48.3 | standard | NEMA MG 1: service factor 1.15 — warning at 110 %, alarm at 115 % of the nameplate current |
| Differential pressure (`cdu/dp_bar`) | bar | 1.8 | < 1.44 or > 2.16 | < 1.17 or > 2.43 | assumed | declared training setting: ±20 % warning, ±35 % alarm of the design differential pressure |
| Pump speed (`cdu/pump_rpm`) | rpm | — | — | — | no band | control output of the VFD: its value follows demand, it has no alarm band |
| Control valve (`cdu/valve_pct`) | % | — | — | — | no band | control output: its position follows the loop, it has no alarm band |
| CHW supply (`chiller/chw_supply_c`) | °C | 19 | > 20 | > 21 | assumed | declared training setting: +1 K warning, +2 K alarm above the engine CHW supply setpoint |
| CHW return (`chiller/chw_return_c`) | °C | 27 | > 28.5 | > 30 | assumed | declared training setting: ±1.5 K / ±3 K around the engine setpoint (plate-HX approach) |
| CDW in (`chiller/cdw_supply_c`) | °C | 37 | > 38.5 | > 40 | assumed | declared training setting: ±1.5 K / ±3 K around the engine setpoint (plate-HX approach) |
| CDW out (`chiller/cdw_return_c`) | °C | 43 | > 44.5 | > 46 | assumed | declared training setting: ±1.5 K / ±3 K around the engine setpoint (plate-HX approach) |
| Compressor VFD (`chiller/vfd_pct`) | % | — | — | — | no band | control output |
| Bearing temperature (`chiller/bearing_c`) | °C | — | — | — | no band | no published limit for the magnetic-bearing class the page names |
| Fluid leaving (`dry-cooler/leaving_c`) | °C | 37 | > 38.5 | > 40 | assumed | declared training setting: ±1.5 K / ±3 K around the engine setpoint (plate-HX approach) |
| Fan motor temperature (`dry-cooler/motor_c`) | °C | 62 | > 130 | > 155 | assumed | IEC 60034-1 thermal class F: 155 °C alarm; 130 °C warning is a declared setting |
| Ambient DB (`dry-cooler/ambient_c`) | °C | — | — | — | no band | weather: an input, not a controlled value |
| Fan speed (`dry-cooler/fan_pct`) | % | — | — | — | no band | control output |
| CDW supply (`cw-pump-station/cdw_supply_c`) | °C | 37 | > 38.5 | > 40 | assumed | declared training setting: ±1.5 K / ±3 K around the engine setpoint (plate-HX approach) |
| CDW return (`cw-pump-station/cdw_return_c`) | °C | 43 | > 44.5 | > 46 | assumed | declared training setting: ±1.5 K / ±3 K around the engine setpoint (plate-HX approach) |
| Discharge head (`cw-pump-station/head_bar`) | bar | 4.5 | < 3.825 or > 5.175 | < 3.15 or > 5.85 | assumed | declared training setting: ±15 % warning, ±30 % alarm of the design head |
| Vibration (`cw-pump-station/vib_mms`) | mm/s | 2.1 | > 2.8 | > 4.5 | standard | ISO 10816-3, group 2 rigid mounting: zone B/C 2.8 mm/s (warning), C/D 4.5 mm/s (alarm) |
| HTW supply (`fws-pump-station/htw_supply_c`) | °C | 37 | < 35.5 or > 38.5 | < 34 or > 40 | assumed | declared training setting: ±1.5 K / ±3 K around the engine setpoint (plate-HX approach) |
| HTW return (`fws-pump-station/htw_return_c`) | °C | 45 | > 46.5 | > 48 | assumed | declared training setting: ±1.5 K / ±3 K around the engine setpoint (plate-HX approach) |
| Discharge head (`fws-pump-station/head_bar`) | bar | 3.8 | < 3.23 or > 4.37 | < 2.66 or > 4.94 | assumed | declared training setting: ±15 % warning, ±30 % alarm of the design head |
| VFD frequency (`fws-pump-station/vfd_hz`) | Hz | — | — | — | no band | control output (capped at 50 Hz) |
| Header pressure (`fws-piping/pressure_bar`) | bar | 2.1 | < 1.785 or > 2.415 | < 1.47 or > 2.73 | assumed | declared training setting: ±15 % warning, ±30 % alarm of the header design pressure |
| TCS supply (`tcs-manifold/tcs_supply_c`) | °C | 40 | > 41 | > 43 | assumed | declared training setting: +1 K warning, +3 K alarm above the engine setpoint; ceiling ASHRAE TC9.9 liquid-cooling class W45 (facility water ≤ 45 °C) |
| TCS return (`tcs-manifold/tcs_return_c`) | °C | 50 | > 51 | > 53 | assumed | declared training setting: +1 K warning, +3 K alarm above the engine setpoint; ceiling ASHRAE TC9.9 liquid-cooling class W45 (facility water ≤ 45 °C) |
| Manifold ΔP (`tcs-manifold/manifold_dp`) | bar | 0.9 | < 0.72 or > 1.08 | < 0.585 or > 1.215 | assumed | declared training setting: ±20 % warning, ±35 % alarm of the design differential pressure |
| Per rack flow (`tcs-manifold/tcs_flow_rack`) | L/min | 182.051282 | < 163.846154 | < 145.641026 | assumed | declared training setting: warning below 90 %, alarm below 80 % of the engine design flow per rack |
| Cold-plate inlet (`rack-ct/inlet_c`) | °C | 40 | > 41 | > 43 | assumed | declared training setting: +1 K warning, +3 K alarm above the engine setpoint; ceiling ASHRAE TC9.9 liquid-cooling class W45 (facility water ≤ 45 °C) |
| GPU junction (`rack-ct/gpu_c`) | °C | — | — | — | no band | no published GB300 junction limit: shown without a band |
| Cold-aisle inlet (`rack-unit/inlet_air_c`) | °C | 25 | < 18 or > 27 | < 15 or > 32 | standard | ASHRAE TC9.9 Thermal Guidelines (5th ed.), class A1: recommended 18–27 °C, allowable 15–32 °C |
| TCS inlet (`rack-unit/tcs_in_c`) | °C | 40 | > 41 | > 43 | assumed | declared training setting: +1 K warning, +3 K alarm above the engine setpoint; ceiling ASHRAE TC9.9 liquid-cooling class W45 (facility water ≤ 45 °C) |
| TCS outlet (`rack-unit/tcs_out_c`) | °C | 50 | > 51 | > 53 | assumed | declared training setting: +1 K warning, +3 K alarm above the engine setpoint; ceiling ASHRAE TC9.9 liquid-cooling class W45 (facility water ≤ 45 °C) |
| GPU utilisation (`rack-unit/gpu_util`) | % | — | — | — | no band | workload, not a plant condition |
| TCS supply (`rack-manifold/tcs_supply_c`) | °C | 40 | > 41 | > 43 | assumed | declared training setting: +1 K warning, +3 K alarm above the engine setpoint; ceiling ASHRAE TC9.9 liquid-cooling class W45 (facility water ≤ 45 °C) |
| TCS return (`rack-manifold/tcs_return_c`) | °C | 50 | > 51 | > 53 | assumed | declared training setting: +1 K warning, +3 K alarm above the engine setpoint; ceiling ASHRAE TC9.9 liquid-cooling class W45 (facility water ≤ 45 °C) |
| Manifold ΔP (`rack-manifold/dp_bar`) | bar | 0.6 | < 0.48 or > 0.72 | < 0.39 or > 0.81 | assumed | declared training setting: ±20 % warning, ±35 % alarm of the design differential pressure |
| Bus voltage (`rack-busbar/vdc`) | V | 48 | < 45.6 or > 50.4 | < 43.2 or > 52.8 | assumed | declared training setting: ±5 % warning, ±10 % alarm of the 48 VDC shelf output |
| Lane errors (post-FEC) (`rack-backplane/ber`) | /h | 0 | > 1 | > 10 | assumed | declared training setting: any post-FEC error per hour is a warning, 10 an alarm |
| CHW in (`crah/chw_supply_c`) | °C | 19 | > 20 | > 21 | assumed | declared training setting: +1 K warning, +2 K alarm above the engine CHW supply setpoint |
| Supply air (`crah/air_supply_c`) | °C | 25 | < 18 or > 27 | < 15 or > 32 | standard | ASHRAE TC9.9 Thermal Guidelines (5th ed.), class A1: recommended 18–27 °C, allowable 15–32 °C |
| Return air (`crah/air_return_c`) | °C | 36 | > 40 | > 45 | assumed | declared training setting: hot-aisle containment, +4 K warning, +9 K alarm above the engine return-air plane |
| Supply RH (`crah/supply_rh`) | % | 45 | < 20 or > 70 | < 8 or > 80 | assumed | ASHRAE TC9.9 class A1: ≤ 70 % RH recommended, 8–80 % RH allowable (alarm); 20 % RH low warning is a declared setting |
| Fan speed (`crah/fan_pct`) | % | — | — | — | no band | control output |
| Tray temperature (`cable-tray/tray_c`) | °C | 32 | > 40 | > 50 | assumed | declared training setting: cable ratings in IEC 60364-5-52 assume 30 °C air; 40 °C warning, 50 °C alarm |
| pH (`chem/ph`) | pH | 8.5 | < 8.2 or > 8.8 | < 8 or > 9 | design | the page's own control window 8.2–8.8 (warning); 8.0 / 9.0 alarm is a declared setting |
| Conductivity (`chem/conductivity`) | µS/cm | 800 | > 1000 | > 1200 | assumed | declared training setting: +25 % warning, +50 % alarm over the control setpoint |
| ORP (`chem/orp`) | mV | 450 | < 400 or > 550 | < 350 or > 650 | assumed | declared training setting around the 450 mV biocide control point |
| Inhibitor (`chem/inhibitor_ppm`) | ppm | 120 | < 102 | < 84 | assumed | declared training setting: warning below 85 %, alarm below 70 % of the residual target |
| Bus voltage (`sld-mv-sub/bus_kv`) | kV | 20 | < 19 or > 21 | < 18 or > 22 | standard | IEC 60038 / SPLN 1: ±5 % operating band (warning), ±10 % (alarm) |
| Frequency (`sld-mv-sub/frequency`) | Hz | 50 | < 49.8 or > 50.2 | < 49.5 or > 50.5 | assumed | Grid Code Jawa-Madura-Bali: 49.5–50.5 Hz normal operation (alarm); ±0.2 Hz warning is a declared setting |
| Bus voltage (`sld-rmu/bus_kv`) | kV | 20 | < 19 or > 21 | < 18 or > 22 | standard | IEC 60038 / SPLN 1: ±5 % operating band (warning), ±10 % (alarm) |
| Top-oil temperature (`sld-main-tx/winding_c`) | °C | 78 | > 90 | > 100 | assumed | IEC 60076-2: 60 K top-oil rise over 40 °C ambient = 100 °C (alarm); 90 °C warning is a declared setting |
| Winding temperature (`sld-tx/winding_c`) | °C | 95 | > 130 | > 155 | assumed | IEC 60076-11 insulation class F: 155 °C (alarm); 130 °C warning is a declared setting |
| DC bus (`sld-msb/dc_bus_v`) | V | 480 | < 456 or > 504 | < 432 or > 528 | assumed | declared training setting: ±5 % / ±10 % of the 480 VDC battery bus |
| State of charge (`sld-ups-b/soc_pct`) | % | 98 | < 90 | < 80 | assumed | declared training setting: warning below 90 %, alarm below 80 % state of charge |
| Tank level (`site-fuel-farm/level_pct`) | % | 95 | < 85 | < 70 | assumed | declared training setting: warning below 85 %, alarm below 70 % of the tank |
| PUE (`hall-kpi/pue`) |  | 1.165168 | > 1.25 | > 1.35 | design | engine design band pue.band_max (warning); 1.35 alarm is a declared setting |
