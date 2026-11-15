# PRD-CONV-BMS-UIUX — W4: the Conventional sheets tell the operator the truth about flow, state and data quality

Owner brief (2026-11-15): `OWNER_BRIEF.md` in this folder ("Tingkatkan kualitas visual dan operasional BMS").
Scope: the Conventional cockpits that draw on the shared HMI sheet renderer — fire FS-M-101, chiller CH-M-101,
water WT-M-101, fuel FU-M-101. datahallAI belongs to the LTC session (R128+) and is out of scope here.

## Measured state (survey of 118ef766e, every line re-checked in source)

| brief area | today | evidence |
|---|---|---|
| Flow motion | tied to unit state or constants, never to a measured flow with quality; water returns `'running'` for every edge | `water-system.html` `waterFlow`; `fuel-system.html` `fuelFlow` reads `state.pumpRunning`; chiller treats flow < 1.5 as "disconnected" (a valid zero looks like a fault) |
| Command vs feedback | one run state per pump; no page shows cmd and fb apart | `fireRead`, `chwRead`, `waterRead` (hard-coded `'running'`), `fuelRead` |
| Pump fail interlock | fuel alarm text exists but `interlocks.pumpfail` is only ever set `false` | `fuel-system.html` :1007, :1285, :1594 |
| Data quality | one page-wide fail-closed switch; `js/rz-telemetry-quality.js` per-point states loaded but `markPoint` is never called | `grep -c markPoint` = 0 on all four pages |
| Alarm without colour | alarm is colour + bold value only; `.hmi-alm-mark` is styled but nothing draws it | `css/rz-hmi.css` alarm rules; 0 emitters |
| Selected / acknowledged | selected = info colour only; acknowledged never reaches the sheet | `js/rz-hmi-sheet.js` `is-selected` |
| Inspector | fire and fuel open nothing on a click; chiller/water keep `is-selected` after close | `opts.open` absent on fire and fuel |
| Scenario seams | no way to force comm loss, a stale point or a cmd/fb mismatch on any page | no `?scenario=` / test seam |
| Performance | no frame-interval gate for these pages | — |

## Laws (each is a check in `tools/test-conv-bms-truth.mjs`, proven red on 118ef766e before it is trusted)

- **B1 flow follows evidence.** An edge animates only when its flow point is measured, of good quality and > 0.
  A valid zero renders `stopped` (dashed, no motion, value prints `0 <unit>`); a stale or bad point renders
  `unavailable` with a quality word on the value (`STALE` / `BAD` / `NO DATA`), never a motion and never `0`.
- **B2 command and feedback are both on the sheet.** Every pump shows `CMD ON|OFF` and `RUN|STOP` as two values; a
  mismatch adds a non-colour alarm mark on the symbol and the flow on its branch stays still (brief §7 scenario 1).
- **B3 one point stale, alarm stays.** Making one point stale changes only that value and its edges; an active alarm
  on the same asset stays visible; restoring the point returns the live value (scenario 5).
- **B4 alarm, selected and acknowledged are distinguishable in greyscale.** Alarm = drawn mark shape + value text;
  selected = outline frame; acknowledged = mark without blink and `ACK` text. Checked on a desaturated screenshot by
  shape/attribute, not hue (brief §7 step 2).
- **B5 every asset opens.** A click or Enter on any equipment symbol on all four pages opens its detail (tag, state,
  mode, alarm, values with quality); closing it returns focus, keeps the selection outline, the pan and the zoom.
- **B6 reduced motion keeps meaning.** Under `prefers-reduced-motion: reduce` no element animates; running edges keep
  static arrows, stopped and unavailable edges carry none.
- **B7 performance has a number.** p95 frame interval over 30 s of pan/zoom with telemetry ticking: <= 20 ms at 1440 px
  desktop, <= 34 ms on the 390 px mobile profile; alarm-to-mark latency measured and reported.

Scenarios 3 (signed reverse flow) and 4 (breaker closed, voltage missing, 0 kW) do not apply to these four
mechanical sheets: no path is declared reversible and none carries breaker feedback. They belong to the EPMS / SLD
pages and are recorded here as **not applicable, with reason**, not as passed.

## Work packages

| WP | content | DONE = |
|---|---|---|
| W4-0 | test seam `window.RZConvSim` on all four pages (deterministic tick; set point value/quality; set pump cmd/fb; trip; ack) — simulated mode only, never in a live data path | the gate can drive every scenario |
| W4-1 | per-point quality through `RZTelemetryQuality.markPoint`, value cells print the quality word, edges derive flow from the measured point | B1, B3 |
| W4-2 | cmd/fb values + mismatch mark; fuel `pumpfail` reachable | B2 |
| W4-3 | renderer: draw `.hmi-alm-mark`, selection frame, ack state | B4 |
| W4-4 | `open` on fire and fuel; restore selection/pan/zoom | B5 |
| W4-5 | reduced-motion and perf gate | B6, B7 |
| W4-6 | standards (`CONVENTIONAL_DC_OPERATIONS_STANDARD.md`), CHANGELOG, screenshots before/after | ship |
