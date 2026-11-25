# PRD-DCAI-HALL-DEPTH — Amendment 6: a reading without a sample looks stale (phase A5e)

Owner, standing: "Continue improve more"; "animasi state, indikasi banyak yg belum ada"; no fake functionality.
Amendment 1 §8.1 lists COMMS LOST / STALE: "grey with a '?' in the tooltip; value shows '—'; dotted ring; still".
Amendment 3 §2 deferred it.

## 1 · What is wrong (measured on 3f3c82fa9, replay provider returning no sample for every point, 1440 and 390)

| # | Measured | Should be |
|---|----------|-----------|
| F1 | 583 lamps stay `run` green. CDU-07's tooltip says "running · pump 98.9 %". | A running unit whose telemetry has no sample shows the stale lamp, and its tooltip says "no sample". |
| F2 | The status strip reads "Stale 0": `stalePct` is the constant 0 in `rules()`. | Stale = the stale units of this hall. |
| F3 | The HMIs print the raw missing value: CDU "P1 null%", CRAH "null% RH", "Total: NaN kW", "Last changed: null days ago"; dry-cooler "Vib: NaN mm/s"; chiller "VFD null%"; CW pump "null RPM (null%)"; MV substation "null%" gauges and "null/455A (0%)". | "—". |
| F4 | Four HMI templates call `P.n(x).toFixed()`: without a sample that throws and the HMI does not draw. | Draws with "—". |
| F5 | The summary line inside an open modal is written once and keeps the old Stale count after the replay ends. | It follows the strip. |

## 2 · Design

- **C1 — Stale from the payload.** `hall-iso.js` `unitStates()` marks a CDU or fan-wall unit `stale` when its own HMI
  payload holds a replay row without a sample (`quality: 'replay'`, value null or "—"). No new source: the payload the
  HMI shows is the one the floor reads (Amendment 1 §10).
- **C2 — The lamp.** `floor-plan.js`: a running unit with `stale` gets `data-lamp="stale"` (dotted muted ring, no fill),
  `data-state="stale"`, a still rotor, and a tooltip "stale · no sample at the replay time" without the operating-point
  lines. Only DC AI sets the flag; the Conventional floor is unchanged. A standby unit keeps its standby lamp: standby is
  the command, not a reading.
- **C3 — Counted.** `RZHallIso.stale()` = stale units; the strip's Stale chip, the modal summary line and the legend
  ("stale", only while one shows) read it. The table State column says "stale: no sample at the replay time".
- **C4 — Follows the scrubber.** The 3 s floor tick re-reads unit states while a replay provider is set, and once more
  when it clears; normal mode keeps its cost.
- **C5 — The dash, never null.** In `datahallAI.html`: display concatenations `P.n(x)+'unit'` become `P.v(x)` (145 sites;
  `P.v` is the payload's own text, "—" without a sample); template prints of `P.n`-derived values go through `nz()`;
  `x.toFixed(d)` in a template goes through `nzf(x, d)`; `cbGauge` and `cableAmp` draw the track and "—". Arithmetic
  uses of `P.n` are untouched.
- **Not in this phase.** Rack lamps: a rack's lamp is the engine's rack state, not a telemetry point. MAN lamps: no
  hand/auto source exists (Amendment 5 §2).

## 3 · Laws (`tools/test-dcai-stale.mjs`)

- **ST1.** Under the no-sample replay, at 1440 and 390: the set of stale lamps = the running CDU and fan-wall units whose
  payload holds a replay row without a sample (counted by the test from the payloads, 143); a stale lamp has no fill and
  a dashed stroke. No page error.
- **ST2.** A stale unit's tooltip says "no sample" and not "running"; its table State says stale.
- **ST3.** The CDU, CRAH and rack HMIs print no "null", "NaN" or "undefined".
- **ST4.** Normal and after the replay clears: 0 stale lamps and every Stale chip 0; under it, every Stale chip = 143.
- **ST5.** The legend lists "stale" only while a stale lamp is on the floor.
- **ST6.** Under the replay, one HMI of each of the 30 equipment classes on every tab opens with no page error and no
  "null" / "NaN" / "undefined" (27 open a modal or the inspector).

Red on 3f3c82fa9: 74 of 89. Green: 89 / 89.

## 4 · Risks

- **R1.** `datahallAI.html` is shared. The rewrites are mechanical and keep every finite number's text: `nz(v)` and
  `nzf(v, d)` return the same text as before for a finite number. `P.v` prints the payload's formatted text, which
  has the payload's digits.
  Measured 2026-11-25 (throwaway probe wrapping `safePayload().v` over the ST6 sweep in normal mode): 399 reads with a
  finite value, every text a bare number except `unit_flow_m3h` ("41 m³/h"), which the dry-cooler HMI already printed alone
  before this phase. The first probe wrapped a frozen object and saw 0 calls; it was rebuilt before it was trusted.
- **R2.** The floor tick re-reads 145 payloads only while a replay is set.

## 5 · Status

A5e built 2026-11-25 on 3f3c82fa9. Screenshots read under the no-sample replay: 1440 and 390 (CDU and fan-wall lamps
dotted, legend "stale", GPU% "—").
