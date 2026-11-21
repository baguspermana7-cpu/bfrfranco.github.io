# PRD-CONV-POINT-STATUS-TREND — every number shows its state, every number opens its trend

Status: **APPROVED TO EXECUTE 2026-11-20.** The owner asked for the plan and the PRD before execution:

> "Parameter angka yg normal kasih warna hijau atau semacamnya misa temp tcs 35degC terua warna kuning saat 37degC atau
> merah, dan semua angka juga saat di klik bisa keluar modal trendline dan ada tombol 1d, 7d dsnya yg sangat intuitive.
> Rancang planning dan prdnya secara comprehensive baru eksekusi"

Standing order (2026-11-18): "kamu yang lakukan, autonomous … jangan tanya saya". The defaults in §12 stand unless the
owner overrides them.

Scope: the 9 DC Conventional pages (`dc-conventional`, `datahall`, `chiller-plant`, `water-system`, `fire-system`,
`fuel-system`, `ict`, `EPMS_Telemetry`, `cdu-mini-bms`). `datahallAI.html` and `js/datahall-ai/*` belong to the DC AI
session. That session adopts the shared modules by agreement, after this PRD ships (§11).

Builds on:
- `PRD-CONV-LIVING-PLANT` §7. Trend P2 shipped `js/rz-trend.js` and `js/conv/history.js`.
- `PRD-CONV-EQUIPMENT-TRUTH`. Audit finding F15, "normal state in saturated colour", is superseded for VALUES by the
  owner's decision OD-1 below. Symbols and lines keep the ISA-101 rule.

---

## 1. Where the pages are today (measured 2026-11-20, origin/main 2bc05a8b5)

| fact | evidence |
|---|---|
| A trend modal exists: `RZTrend` 5m / 1h / 8h / 24h / 7d, up to 8 pens, hi / lo limit lines, URL state | `js/rz-trend.js:21` |
| A deterministic history exists: `RZConvHistory.value(def, minute)` returns the same value on every device. It is labelled SIMULATED. | `js/conv/history.js` |
| Only the equipment-modal rows register trend points. No number on a sheet, KPI tile or table opens a trend. | `js/conv/equipment-modal.js:107` (the only `RZTrend.register` call) |
| `dc-conventional`, `ict`, `datahall` and `cdu-mini-bms` do not load `rz-trend.js` at all | grep: trend 0 on those 4 pages |
| The parameter registry has 278 parameters and **0 limits** | `data/conv-parameters.json`: no `limits` field |
| Limits that do exist are typed per page and disagree in shape | `cdu-mini-bms.html:455` (`low:1.30`), `:659` (`lo:1.0, hi:1.5`); `chiller-plant.html:1170` (`low:0`); `water-system.html:819` (`warn: 0`) |
| Baseline per page: numbers shown / numbers that open a trend / numbers carrying a state | §1.1, measured by the T0 inventory |

### 1.1 T0 inventory (1440 px, signed-in audit state, 6 s after load)

Measured 2026-11-20 on the T0 tree (757c2a09f + the T1 shared files, which no page wires yet) with
`tools/test-conv-point-coverage.mjs --report`. A number is a text token followed by a unit; "open a trend" = inside
`[data-trend]` / `[data-point]`; "constants" = inside `[data-const]`. These numbers are the ratchet floor
(`tools/conv-point-coverage-baseline.json`): unclassified may only fall.

| page | numbers with a unit | open a trend | carry a state | constants | unclassified |
|---|---|---|---|---|---|
| `dc-conventional.html` | 27 | 0 | 0 | 0 | 27 |
| `datahall.html` | 111 | 0 | 0 | 0 | 111 |
| `chiller-plant.html` | 64 | 0 | 0 | 0 | 64 |
| `water-system.html` | 69 | 0 | 0 | 0 | 69 |
| `fire-system.html` | 41 | 0 | 0 | 0 | 41 |
| `fuel-system.html` | 59 | 0 | 0 | 0 | 59 |
| `ict.html` | 13 | 0 | 0 | 0 | 13 |
| `EPMS_Telemetry.html` | 93 | 0 | 0 | 0 | 93 |
| `cdu-mini-bms.html` | 35 | 0 | 0 | 0 | 35 |
| **all 9** | 512 | 0 | 0 | 0 | 512 |

Two runs on the same tree gave identical counts; the ratchet still allows max(3, 3 %) for the live simulation.

The inspector and equipment-modal readings that already open a trend are not on screen 6 s after load, so the table counts
none of them; they are counted again when T2/T3 put the points on the sheets and tiles.

### 1.2 Limits migrated to the registry (T0)

Every limit literal found on the 9 pages and in `js/conv/*.js` (grep for `hi` / `lo` / `low` / `warn` / `alarm` / `crit`
literals and the comparisons that set a warn or crit) is now a row of `data/conv-limits.curated.json`. The page code still
carries the literal until T2/T3 rewires it to `RZPointStatus.limits(id)`.

| page literal | registry row | note |
|---|---|---|
| `cdu-mini-bms.html:659` flow `lo:1.0, hi:1.5` | `cdu-mini-bms.FT-01.flow_lpm_per_kw` | warn = page band, alarm = the page's `bandState` rule (0.9·lo, 1.1·hi) |
| `cdu-mini-bms.html:661` supply `lo:17, hi:45` | `cdu-mini-bms.TT-01.supply_c` | **superseded by OD-3** (warn 18/37, alarm 15/40 °C) |
| `cdu-mini-bms.html:663` ΔT `lo:8, hi:12` | `cdu-mini-bms.DT-01.delta_t_c` | as above |
| `cdu-mini-bms.html:664` loop dP `lo:0.5, hi:3.0` | `cdu-mini-bms.PDT-02.loop_dp_bar` | as above |
| `cdu-mini-bms.html:665` system press `lo:2, hi:6` | `cdu-mini-bms.PT-01.system_bar` | as above |
| `cdu-mini-bms.html:666` level `lo:45, hi:70` | `cdu-mini-bms.LT-01.level_pct` | as above |
| `cdu-mini-bms.html:670` HX approach `lo:3, hi:7` | `cdu-mini-bms.TT-D.approach_c` | as above |
| `dc-conventional.html:1540` air `> 32` crit, `> 27 \|\| < 18` warn | `environment.avg_temp_c` | STANDARD: ASHRAE 2015 recommended 18–27, A1 allowable 15–32 °C |
| `dc-conventional.html:1541` RH `> 80 \|\| < 20` warn | `environment.avg_rh_pct` | ASSUMED (RH-only band kept; ASHRAE 2015 is dew-point based) |
| `datahall.html:1201` `RACK_INLET_RECOMMENDED_MAX_C = 27`, `:1979` `alarmC: 30` | `datahall.rack.inlet_c` | high side doc-03, low side ASHRAE |
| `datahall.html:1415-1416` rack `util > 0.95` crit, `> 0.85` warn | `datahall.rack.load_pct` | ASSUMED (doc-03 alarm rules) |
| `fuel-system.html:1183-1184` UST `< 30` crit, `< 60` warn; `:1191` `> 95` overfill | `fuel.level_pct` | the engine's `fuel.level_low_pct` / `level_low_low_pct` / `level_overfill_pct` |
| `fuel-system.html:1071` `DT_LOW = 30, DT_LOWLOW = 25, DT_HIGH = 90` | `fuel-system.DT.level_pct` | DT_HIGH is the pump-stop setpoint, not a limit |
| `fire-system.html:696-698` `P_JOCKEY_ON 11.5`, `P_FP1_ON 10.5`, `P_LOW_ALM 8.5` | `fire.static_pressure_bar` | low side from the mimic; high side ASSUMED (PN16); NFPA 20 not read |

Reviewed and not limits: `chiller-plant.html:1170` (`low:0` is a loop state), `water-system.html:818-819`,
`ict.html:1815/1914/1930`, `fuel-system.html:1217`, `fire-system.html:1138`, `dc-conventional.html:1525` (`warn = 0`,
`crit = 0` are alarm counters).

New rows with no page literal: `cooling.crah_supply_air_c` (STANDARD, ASHRAE as above), `cooling.chws_c` and
`cooling.cdw_supply_c` (engine design value ± 1.5 K warn / ± 3.0 K alarm, ASSUMED), `electrical.ups_load_pct_normal`
(2N: warn 45, alarm 50 %, ASSUMED), `fuel-system.GEN.load_pct` (warn at `electrical.genset_max_loading` 80 %, alarm
100 %, ASSUMED). ASHRAE source actually read: ASHRAE TC 9.9, *Data Center Power Equipment Thermal Guidelines and Best
Practices* (2016), Table 2 "ASHRAE 2015 Thermal Guidelines" — Recommended (A1–A4) 18 to 27 °C; Allowable A1 15 to 32 °C.

---

## 2. Product goal

An operator sees two things at a glance:
- which numbers are fine, which are drifting and which are out of limits;
- with one click or tap, how any number got there: the last hour, day, week or month, against its limits.

**Outcome, measured.** On every one of the 9 pages:
1. Every number that varies in time opens its trend.
2. Every number that has an operating limit is coloured by its state.
3. Every other number is classified (§3, P-3) and, where it can be clicked, opens its basis.

## 3. Principles (each one is a law a gate can check)

- **P-1 One source of limits.** Every limit lives in one registry (§5) with its value, unit, basis and source.
  No page types a limit. A page reads `RZPointStatus.limits(id)`.
- **P-2 State follows the limits, nothing else.** state = classify(value, limits, previous state), using the ISA-18.2
  deadband rule (§4.2). A colour never comes from a scenario name, a random draw, or the page.
- **P-3 Every number is classified.** Each rendered number is exactly one of:
  - **point with limits**: coloured, trends;
  - **point, informational** (varies in time, no operating limit, e.g. a flow total): neutral colour, trends;
  - **constant** (a rating, a count, a design value): neutral colour, opens its basis, not a trend.
- **P-4 Colour is never the only cue (WCAG 1.4.1).**
  - Warning carries a ▲ glyph. Alarm carries a ◆ glyph and a 1 px outline. Normal carries no glyph.
  - The state is also in `aria-label` and in the tooltip.
  - Every state colour meets 4.5:1 against its own surface in both themes.
- **P-5 The trend tells the same story as the page.**
  - The last point of the trend equals the number on the page, at the page's rounding.
  - The state chip in the trend header equals the colour on the page.
  - The limit bands in the trend are the registry's limits.
- **P-6 A normal plant has a normal past.** In the NORMAL scenario, the 30-day history of every point with limits
  stays inside its normal band at least 99 % of the time. A point that is green now never shows a red week.
  Excursions come only from a scenario or from an engine value that breaches a limit.
- **P-7 Simulated, and labelled as simulated.**
  - Every history is `RZConvHistory`, deterministic and labelled SIMULATED in the modal.
  - Limits whose basis is an assumption carry evidence class ASSUMED, shown in the tooltip.
  - No `Math.random` (ACCURACY_VALIDATION rule 2).

## 4. Design

### 4.1 State colours (owner decision OD-1: normal is green)

These are text colours on the number. No fill, no glow, no badge background.

| state | dark theme | light theme | glyph | when |
|---|---|---|---|---|
| normal | `#3fb950` | `#1a7f37` | — | inside [lo_warn, hi_warn] |
| warning | `#e8b563` | `#7a4800` | ▲ (▼ for a low warning) | outside the warn band, inside the alarm band |
| alarm | `#ff6b5e` | `#b42318` | ◆ + 1 px outline | outside [lo_alarm, hi_alarm] |
| informational / constant | page ink | page ink | — | P-3 |
| no data / not modelled | page mute, italic "—" | page mute | — | value null or stale |

- Tokens: `--rz-pt-ok`, `--rz-pt-warn`, `--rz-pt-alarm`. They are defined once in `css/conv-point.css` and are never
  literal in a page.
- **Flat view** (the sheet's existing ISA-101 strict mode, `rz-hmi-sheet.js` shade mode) keeps normal values in page
  ink. Warning and alarm stay coloured. The operator who wants strict ISA-101 has it one click away. The default is
  the owner's.
- Symbols, pipes and fills keep their existing state vocabulary. This PRD colours numbers only.

### 4.2 Classification

`RZPointStatus.classify(v, L, prev)`, where `L = { lo_alarm, lo_warn, hi_warn, hi_alarm, deadband }`:
- Rising: warn at `v > hi_warn`; alarm at `v > hi_alarm`.
- Clearing: back to warn only when `v < hi_alarm − deadband`; back to normal only when `v < hi_warn − deadband`.
- The low side mirrors the high side. Any bound may be null.
- The deadband default is 1 % of span (ISA-18.2 §11.4 style), set per point in the registry.
- Pure function, Node-testable. A gate replays a series and checks for no chatter at the threshold.

Owner example, TCS supply °C (registry row; basis ASSUMED until the owner gives the site design):
`hi_warn 37, hi_alarm 40, lo_warn 18, lo_alarm 15, deadband 0.3`. 35 °C is green, 37.1 °C amber ▲, 40.1 °C red ◆.

### 4.3 Click → trend (owner: "sangat intuitive")

- **Opening.**
  - Click, tap, Enter or T on any point opens the trend with that point as pen 1.
  - Hover or focus shows a tooltip: name, value, state, limits (`warn 37 · alarm 40 °C`), "Click for trend".
- **Range bar.** One segmented control at the top: `1H · 8H · 1D · 7D · 30D`.
  - Default **1D**: the owner named it first.
  - The last range used is remembered for the session.
  - Keys 1–5 select a range. The buttons are ≥ 44 px on a phone.
  - `5m` and `24h` are renamed or folded in. Old URLs `#trend=…&r=24h` still restore, mapped to 1D.
- **Plot.**
  - Normal, warning and alarm BANDS are shaded faintly behind the line from the registry limits, and their limit
    lines are labelled.
  - The engine reference stays as a dashed line.
  - A cursor follows the pointer or a finger drag and reads time · value · state.
- **Header.** Point name · current value in its state colour with glyph · state word · unit · source (SIMULATED /
  ENGINE) · evidence class of the limits.
- **Footer stats** for the range: min · max · mean · time in warning % · time in alarm % · number of excursions.
- **Compare.** Keep the existing "+" multi-pen. Picking a pen from the same system is one tap.
- **Phone (≤ 600 px).**
  - The trend opens as a bottom sheet (`js/rz-sheet.js`, the house sheet) at 88 % height.
  - The range bar sticks to the top, the plot is full width, and the stats are a two-column list.
  - Swipe down or Esc closes it.
- **Export.** CSV of the shown range (already in `history.csv`).
- **Focus.** Focus returns to the number that opened the modal. Focus is trapped inside the modal. The page
  behind it is inert.

### 4.4 What gets a point

| surface | today | target |
|---|---|---|
| Sheet value labels (`RZHmiSheet` text bound to a tag) | plain text | point: state colour + trend; the renderer carries `data-point` |
| KPI tiles / status strips | plain text | point |
| Tables (inspector, alarm list values, fleet strips) | partly | point, or constant (P-3) |
| Equipment-modal rows | trend only | trend + state colour |
| Ratings, counts, design values | plain | constant: neutral, click opens basis (`RZSvgBasis` / basis drawer) |

## 5. The limits registry

- **Source of truth:** `data/conv-limits.curated.json`, hand-written and reviewed. One row per point id:
  `{ id, unit, lo_alarm, lo_warn, hi_warn, hi_alarm, deadband, basis, evidenceClass, source: { ref, asOf } }`.
- **Built:** `tools/build-conv-parameter-registry.mjs` merges the rows into `data/conv-parameters.json` as `limits`.
  The freshness gate already covers that builder.
- **Point ids** are the registry ids (`cooling.cdw_supply_c`, …). Points with no registry id (live simulated tags)
  get ids `<page>.<tag>.<quantity>` and are listed in `data/conv-points.json` with the history definition
  `{ base, amp, shape, digits }` and their registry link.
- **Basis order:**
  1. a published standard: ASHRAE TC 9.9 air classes A1 (inlet recommended 18–27 °C, allowable 15–32 °C);
     ASHRAE liquid-cooling W classes for facility water; NFPA 20 / 25 for fire-pump pressures; IEC 60038 for voltage
     bands; the fuel autonomy basis already declared on FU-M-101;
  2. the engine's design value ± a declared margin;
  3. an ASSUMED operating value, named as such.
- Each row states which basis it uses. A standard value is checked against the cited clause by reading it, never
  from memory. A row whose clause cannot be read is marked ASSUMED (lesson `feedback_source_register_cannot_catch_transcription`).

## 5b. The numbers live in the database (owner 2026-11-20: "Angka2 itu harus dimasukkan database")

Owner decisions taken with the question tool on 2026-11-20:
- **OD-6:** limits AND history go to Supabase.
- **OD-7:** the samples are written inside the database by `pg_cron`. No secret lives outside the database.

**Tables.** Migration `supabase/migrations/2026-11-20-conv-points.sql`, idempotent:

| table | rows | content | access (RLS) |
|---|---|---|---|
| `conv_points` | one per point (~300) | id, label, unit, page, `lo_alarm lo_warn hi_warn hi_alarm deadband`, basis, evidence_class, source_ref, source_as_of, history definition (`hist_base hist_amp hist_shape hist_digits`), updated_at, updated_by | select: everyone (anon). insert/update: `public.is_root()` only. Every change goes to `audit_log` with the old and new row. |
| `conv_point_samples` | point × 5 min, kept 48 h (≈ 170 k) | point_id, ts, value; PK (point_id, ts) | select: everyone. Write: only the definer function. |
| `conv_point_rollup` | point × 30 min, kept 35 d (≈ 500 k) | point_id, ts, v_min, v_max, v_mean, n | same |

Size, measured after `conv_backfill(30)` in the local `postgres:16` (`pg_total_relation_size`, T1b 2026-11-21) for
the 19 points of `data/conv-points.json`: 38 323 rows, 6.24 MB (`conv_points` 19 rows 0.06 MB, `conv_point_samples`
10 944 rows 1.87 MB, `conv_point_rollup` 27 360 rows 4.31 MB). It grows linearly: about 0.33 MB per point, so the ~300
points of T2/T3 would be about 100 MB, inside the 500 MB free tier. Re-measured when the point list grows.

**Writer.** `conv_sample_tick(at timestamptz)` is SECURITY DEFINER and runs every 5 min from `cron.schedule`. It:
1. writes one sample per point from the SQL port of `RZConvHistory.value(def, minute)` (FNV-1a hash, integer noise,
   shapes `flat` / `load` / `saw`, bounded per P-6). The model is deterministic, so the database equals the browser's
   fallback.
2. rolls up the closed 30-min window;
3. prunes past the retention.

`conv_backfill(days int)` fills the last 30 days once at install.

**Reader.** `conv_point_series(id, from, to)` is a stable RPC. It reads samples when the window is ≤ 24 h and the
rollup otherwise, and returns `{t, v}` or `{t, min, max, mean}`.

**Client.**
- `RZPointStatus` loads limits from `conv_points` after first paint. The cache is 5 min in sessionStorage, like the
  feature flags. If Supabase is down or not configured, the shipped `data/conv-parameters.json` is used.
- `rz-trend.js` asks the RPC. When it falls back to the local model, the header says "local model (database
  unreachable)" instead of the database source label. A page never shows a number from two sources at once.

**Root editing.**
- rz-ops gets a "Point limits" tab: one table, edit bounds and basis, saved through `conv_points` update under RLS.
- A non-root save is refused by the database, not by the page.

**Exports.** `tools/build-conv-points-seed.mjs` turns the curated limits plus the point list into the migration's
seed `insert … on conflict do update`. The freshness gate covers the seed, so git and the database start equal.

**Owner action (the only one).** Run the migration once in the Supabase SQL editor; it enables `pg_cron`, creates the
objects, seeds and backfills. I never hold the service key. Until the owner runs it, the site uses the local
fallback and the gates prove both paths.

**Gates added:**
- `test-conv-points-sql.mjs`: runs the migration in the local `postgres:16` container, which is already on this
  machine (no download, `pg_cron` stubbed).
  - **Parity:** `conv_sample_tick` values equal `RZConvHistory.value` for 50 points × 2,000 minutes, to the digit.
  - **Rollup:** min/max/mean equal a JS recomputation.
  - **Retention:** samples older than 48 h and rollups older than 35 d are pruned.
  - **RLS:** anon cannot update; a root JWT can; the update writes `audit_log`.
  - **RPC:** a window ≤ 24 h reads samples; a longer one reads the rollup.
  - **Planted defects that must turn it red:** a changed hash constant, a missing prune, an RLS policy that lets
    anon write.
- `test-conv-trend-ranges.mjs` grows two modes:
  - Supabase stubbed with the RPC (as `test-feature-overrides.mjs` does). The trend shows the DB series and its
    source label.
  - Supabase down. The trend shows the fallback and says so, with 0 errors.
- Live, after the owner runs the migration: anon `conv_point_series` on 3 points returns rows whose timestamps
  advance every 5 min. Proven by two reads 6 min apart.

## 6. Architecture

| module | role | status |
|---|---|---|
| `js/conv/point-status.js` → `window.RZPointStatus` | `limits(id)`, `classify()`, `apply(el, id, value)` (sets `data-pt-state`, glyph, aria, tooltip), `bindAll(root)` (each `[data-point]` gets its trend and state) | new; UMD core so Node can test it |
| `css/conv-point.css` | tokens, glyphs, outline, focus ring, tooltip | new |
| `js/rz-trend.js` | ranges 1H/8H/1D/7D/30D, bands, header state chip, stats, bottom sheet on a phone, old-range mapping | changed, same public API |
| `js/conv/history.js` | 30D at 30-min step; NORMAL histories bounded per P-6 (amp chosen from the limits, not free) | changed, additive |
| `js/rz-hmi-sheet.js` | value labels carry `data-point` from the sheet model; restyled through `RZPointStatus.apply` on every scan | additive |
| `data/conv-limits.curated.json`, `data/conv-points.json` | limits and points | new |
| 9 pages | load the 3 shared files; mark tiles / tables with `data-point` or `data-const` | changed |

**Series providers and explicit limits (T1b, for the DC AI peer and any page outside the registry):**
- `RZTrend.register(points, { provider })`. `provider.series(id, fromMs, toMs, stepMin)` returns a Promise of `[{t, v}]`
  or, for long ranges, buckets `[{t, min, avg, max, n}]` (drawn as a min–max band plus the avg line; stats = min of
  mins, max of maxes, mean of avgs weighted by n), or `null` = no history here (local model, no warning).
- Without a provider a point uses the default: `RZTrend.dbProvider` (the `conv_point_series` RPC) when Supabase is
  configured and the id is a database point, else `RZConvHistory`. The conv database reader is itself a provider.
- A provider that rejects or answers after 4 s turns that open to the local model for every pen, with the line
  "Database unreachable — local SIM history" and the source "Local model (database unreachable)". One open never
  shows two sources.
- `RZPointStatus.define(id, L)` (registry shape) and `RZPointStatus.fromSimple({ warn, alarm, kind: 'high' | 'low' |
  'window', deadband?, lowWarn?, lowAlarm?, ...meta })` → L. Both throw on a bound-order violation.
- Precedence of `limits(id)`: database row (`conv_points`) > `define()` > shipped registry, except that a database row
  never overrides a `define()` of an id the shipped conv registry does not know.

No new dependency. Zero-build. Every shared file changes additively and gets its token fixed with `--fix`, naming
only the files we changed.

## 7. Gates (each one red on today's tree, or on a planted defect, before it is trusted)

| gate | proves |
|---|---|
| `test-conv-point-status-core.mjs` (Node) | classify: thresholds, deadband (no chatter on a series oscillating ±0.1 around hi_warn), null bounds, null value. Registry: every row has unit + basis + source, lo_alarm ≤ lo_warn < hi_warn ≤ hi_alarm, no page-typed limit left (grep of the 9 pages for `hi:`/`low:` literals = 0). P-6: in NORMAL, 30D history inside the normal band ≥ 99 % per point. Planted: swapped bounds, a missing deadband, an amp that breaches. |
| `test-conv-point-coverage.mjs` (browser, 1440 + 390) | Inventory of every rendered number: 100 % classified (P-3). Point with limits → `data-pt-state` = classify(engine value). State colour contrast ≥ 4.5:1 in both themes. Glyph present for warn/alarm. `--report` prints the per-page table of §1.1. Ratchet: unclassified count may only fall. |
| `test-conv-trend-ranges.mjs` (browser) | Every point opens a trend on click, Enter and tap. Ranges 1H/8H/1D/7D/30D switch the window and the stats. Last point = page value (P-5). Header state = page state. Bands = registry. Keyboard 1–5, Esc, focus return. 390: bottom sheet, range bar 44 px, no sideways scroll. `#trend=…&r=24h` restores 1D. 0 page errors. |
| existing conv release gates (`tools/run-conv-release-gates.sh`) + the static audits | no regression; perf gate: per-scan restyle stays under the sheet-perf budget (state is written only when it changes) |

Screenshots at 1440 and 390, dark and light, of one sheet, one KPI strip and one trend at 1D and 7D are looked at
before each release.

## 8. Phases and releases

| phase | content | release |
|---|---|---|
| **T0** | Inventory gate (`--report`) on today's tree → §1.1 floor; limits registry: curated rows for every point with a basis, builder merge | with T1 |
| **T1** | `RZPointStatus` core + CSS + Node gate; `rz-trend.js` ranges, bands, header, stats, phone sheet; history P-6 | MINOR |
| **T1b** | Database (§5b): migration + seed builder + SQL parity gate in local Postgres; `RZPointStatus` limits from `conv_points`, `rz-trend.js` series from the RPC, both with the labelled fallback; rz-ops "Point limits" tab (root) | MINOR; live DB check after the owner runs the migration |
| **T2** | Sheets: `rz-hmi-sheet.js` value labels → points on the 6 sheet pages (chiller CH-M-101/102, water, fire, fuel, EPMS E-S-101/102) | MINOR |
| **T3** | Tiles, strips, tables, equipment-modal rows on all 9 pages; `dc-conventional`, `ict`, `datahall`, `cdu-mini-bms` adopt the trend | MINOR |
| **T4** | Polish pass on screenshots, manuals (`manual/` pages of the cockpits: "reading a value"), CONVENTIONAL_DC_OPERATIONS_STANDARD § point status, UIUX ledger, CLAUDE.md shared-module row | PATCH |

Order constraint: T2 and T3 touch the pages that the E3, fuel-truth and E5-EPMS branches change. They start after
those three are merged on `main`. T0 and T1 touch only shared files and can start now.

Each phase follows the same steps:
1. laws
2. red
3. build
4. green
5. look at the screenshots
6. update the standards in the same release
7. run the whole conv release gate set
8. push
9. verify live

## 9. Risks and limits

- **A coloured normal is busier than ISA-101.** This is the owner's choice (OD-1). Flat view remains the strict
  mode. The colour is on the number only, never on fills.
- **Limits are a model.** Many rows are ASSUMED. The tooltip says so, and the owner can replace a row in one file.
- **Per-scan restyle cost.** The chiller sheet is already at its perf budget (E3). State is written only on change,
  and the cost is measured against origin/main in the same run.
- **A 30-day deterministic history is not a historian.** It is labelled SIMULATED, as today.

## 10. Acceptance (the owner's words → checks)

| owner said | check |
|---|---|
| "normal kasih warna hijau" | coverage gate: points in band have `data-pt-state="ok"` and the computed colour = `--rz-pt-ok` |
| "tcs 35 °C … kuning saat 37 °C atau merah" | core gate: TCS row; 35 → ok, 37.1 → warn ▲, 40.1 → alarm ◆; the browser shows the same on `cdu-mini-bms` |
| "semua angka … di klik bisa keluar modal trendline" | trend gate: every point opens; coverage gate: 100 % classified, constants open their basis |
| "tombol 1d, 7d dsb … sangat intuitive" | range bar 1H/8H/1D/7D/30D, default 1D, keys 1–5, ≥ 44 px on a phone, bands + state header + stats; screenshots looked at |

## 11. Peer coordination

`datahallAI.html` (DC AI session) can adopt `RZPointStatus` + `rz-trend.js` once T1 ships. A message announces the
API and the shared-file tokens. Nothing in `js/datahall-ai/*` is edited here.

## 12. Owner decisions (defaults stand if not overridden)

| id | decision | default |
|---|---|---|
| OD-1 | Normal values coloured | green text (owner), Flat view keeps ISA-101 muted |
| OD-2 | Range set | 1H · 8H · 1D · 7D · 30D, default 1D |
| OD-3 | TCS limits until a site design is given | warn 37 / alarm 40 °C high, warn 18 / alarm 15 °C low, ASSUMED |
| OD-4 | Constants (ratings, counts) | neutral, click opens the basis, no trend |
| OD-5 | Phone trend | bottom sheet, 88 % height |
| OD-6 | What goes to the database | limits AND history (owner, 2026-11-20) |
| OD-7 | Who writes the samples | `pg_cron` inside Supabase, every 5 min (owner, 2026-11-20) |
| OD-8 | Trend time axis | local time of the viewer (WIB for the owner), zone named on the read line ("GMT+7") — DONE T4, `rz-trend.js` 2.2.0, gate law L12 |

## 13. Status

| phase | status |
|---|---|
| T0 | DONE 2026-11-20 (branch `conv-pst`, local): inventory §1.1 + ratchet baseline, 19 limit rows (§1.2) merged into `data/conv-parameters.json` `limits` |
| T1 | DONE 2026-11-20 (branch `conv-pst`, local): `js/conv/point-status.js`, `css/conv-point.css`, `js/rz-trend.js` 2.0.0, `js/conv/history.js` 1.1.0 (`RANGES`, `bounded`), `js/rz-sheet.js` `onClose`; gates `test-conv-point-status-core`, `test-conv-trend-ranges` (fixture), `test-conv-point-coverage` |
| T1b | DONE 2026-11-21 (branch `conv-pst`, local): migration `supabase/migrations/2026-11-20-conv-points.sql` (3 tables, RLS, audit trigger, SQL port of the history model, pg_cron job, seed, 30-day backfill), `data/conv-points.json`, `tools/build-conv-points-seed.mjs` (freshness gate), gate `test-conv-points-sql.mjs` (local `postgres:16`: parity 100 000/100 000, rollup, retention, RLS + audit, RPC, idempotent; 4 planted defects red), `RZPointStatus` 1.1.0 (DB limits + `define` / `fromSimple`), `rz-trend.js` 2.1.0 (providers, DB series, labelled fallback), `rzSupa.getConvPoints / convPointSeries / setConvPointLimits`, rz-ops "Point limits" tab. **Owner action open:** run the migration once (RUNBOOK-DB.md); the live check (two reads 6 min apart) follows it |
| T2/T3 pilot | DONE 2026-11-21 (branch `conv-t23`, local, on T1b): shared hooks — `rz-hmi-sheet.js` value items carry `point` / `label` (data-point written on the first digit, state applied only when the text changes), `equipment-modal.js` trend rows are points, `rz-basis-drawer.js` leaves a click on a `[data-trend]` to the trend, `conv-point.css` id-weight state rules + reserved glyph width + 1 px hover underline, `point-status.js` keeps an invisible glyph tspan on a normal SVG point. Pages: `chiller-plant` (CH-M-101/102 labels, strip, side cards, supervisory panel, loop table; 90 numbers: 79 trend / 11 constants / 0 unclassified at 1440 and 390) and `cdu-mini-bms` (tiles, P&ID labels; 35: 17 / 18 / 0; TCS 35 °C green, 39 °C amber ▲, trend "Warning"). Limits row `cooling.chwr_c` added (chiller's typed CHWR margins); cdu `TILES lo/hi` + `bandState` removed. Gate `test-conv-point-coverage.mjs` PC1–PC6 on the STRICT pages, ratchet floor 0 for both |
| T2/T3 fuel / water / fire | DONE 2026-11-21 (branch `t3-a`, local, on the pilot): `fuel-system` (108 numbers: 81 trend / 27 constants / 0 unclassified at 1440 and 390; sheet values, KPI strip, tank table, day-tank and genset rows), `water-system` (69: 45 / 24 / 0; the typed alarm thresholds now read the registry), `fire-system` (41: 15 / 26 / 0; tank bounds read the registry). Limits rows added (all ASSUMED, migrated from the page's own typed values): `fuel.autonomy_hr`, `fuel-system.sla_margin_hr`, `water.raw_tank_pct`, `water.dom_tank_pct`, `water.filter_dp_bar`, `water.tds_ppm`, `water.uv_intensity_pct`, `water.wue_l_per_kwh`, `fire.level_pct`. Per-set day-tank levels take the row `fuel-system.DT.level_pct` through `PS.define`. Gate `test-conv-point-coverage` STRICT on all five pages |
| T2/T3 ict + EPMS | DONE 2026-11-21 (branch `t3-b`, local): `ict.html` and `EPMS_Telemetry.html` (HV/MV SLD, LV view, rail, strip) classified to 0 unclassified at 1440 and 390, both in `STRICT`; 3 limits rows (`ict.util_pct`, `ict.poll_freshness_s`, `electrical.tx_load_pct`, the last ASSUMED: no clause read); gate law PC7 plants TX-2 at 72.7 % (opened I1 breaker then tie) and demands warn ▲ and trend header Warning |
| T3 dc-conventional, datahall | DONE 2026-11-21 (branch `t3-c`, local, on the pilot): both pages load `rz-trend.js` 2.1.0 + `point-status.js` + `conv-point.css`. `dc-conventional` (27 numbers: 22 points / 5 constants / 0 unclassified at 1440 and 390; KPI strip, callouts, stats panel, UPS cell split into a point and a constant) and `datahall` (111 at 1440 / 98 at 390: 90 + 21 / 0 unclassified; rollup, thermal chain, balance band, CRAH rows, environment, density, row footers; design values, counts and the event log are constants). Basis hooks moved from a number to its wrapper where a point took the number (a hook and a point on one element both open on Enter). Limits rows added: `fuel.autonomy_hr` (dc-conventional alarm-strip floor 24 / 12 h) and `datahall.cooling.margin_pct` (datahall `< 5 %` warn; both ASSUMED); the min / avg / max / hottest rack inlets read the `datahall.rack.inlet_c` row through `define()`. Gate `test-conv-point-coverage.mjs` STRICT adds both pages, PC7 plants the excursion (hottest rack inlet 28.5 °C: ▲ Warning in the trend). |
| T2/T3 rest | DONE — every Conventional cockpit page is STRICT in `test-conv-point-coverage` (merged on conv-t23 2026-11-21) |
| T4 | NOT STARTED |
