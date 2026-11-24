# PRD-DCAI-HALL-DEPTH — Amendment 4: a flag opens the alarms it stands for (phase A5c)

Owner, standing: "Continue improve more"; "animasi state, indikasi banyak yg belum ada". Amendment 1 §8.2 asked that the
"+n" chip open "the alarm list filtered to the hall". Amendment 3 built the flags and the chip, and A5b put every
scenario alarm into the Alarms & Events journal. Nothing links the two yet.

## 1 · What is wrong (measured on the v3.104.0 tree 110084672 + E2, 1440 and 390, 2D)

| # | Measured | Should be |
|---|----------|-----------|
| F1 | `cdu-pump-fail`: one flag `▲ CDU-01…CDU-54 ×54 · PUMP-1 fault`. `leak-z07`: one flag `◆ Row R07 ×22 · manifold wet`. Each flag is a `span`: no focus, no click, no role. | The flag is a button. Activating it opens Alarms & Events, filtered to the alarms it counts. |
| F2 | The "+n" chip is absent in every scenario at both widths (n = 0: one flag holds each group). The §8.2 path "+n opens the list" is therefore unreachable today. | The chip, when it shows, is a button that opens the active alarms of the hall. |
| F3 | To see the 54 alarm records behind the CDU flag, an operator must switch tab, choose "Active alarms" and type a tag by hand. | One activation. |

## 2 · Design

- **C1 — The flag is a button.** `button.dh-flag`, `type="button"`, accessible name = its text plus "— open in Alarms & Events".
  Same look as today (ink on panel, 1 px state hairline, glyph); a 2 px ink focus outline; no motion.
  At 390 the hit target grows to ≥ 24 px tall with padding outside the hairline box (WCAG 2.2 target size, minimum).
- **C2 — What it opens.** A click or Enter:
  1. activates the `alarms` tab the same way its tab button does;
  2. sets Saved view = `active`, Point / tag = the alarm point of the flag, Search = `<hall>/`;
  3. runs the query once and moves focus to the result count.
  The records behind a flag come from the `alarms()` set that drew it (measured on the tree above):

  | Flag | Units on the floor | Alarm records (A5b journal) | Point |
  |---|---|---|---|
  | `▲ CDU-01…CDU-54 ×54 · PUMP-1 fault` | 54 CDUs | 54, one per CDU, `high` | `PUMP-1` |
  | `◆ Row R07 ×22 · manifold wet` | 22 racks | 1, `LEAK-Z07`, `critical` (a wet row is its leak zone's event) | `ROPE` |

  So a flag's count and its list count differ by design when the floor marks the consequence (wet racks) of one
  alarm (the rope). The flag carries `data-alarms` = the number of records it opens, and its name says both:
  "22 racks · 1 alarm".
- **C3 — "+n".** When shown, `button.dh-flag-more` opens Saved view = `active` and Search = `<hall>/`.
- **C4 — Way back.** The alarm list keeps its own Reset; the Data Hall tab is one tab away. No new back control.
- **C5 — One source.** The filter is built from the same `alarms()` set that drew the flag, never from the flag text.

## 3 · Laws (each red on 110084672)

- **HV-L1.** For `cdu-pump-fail` and `leak-z07`, at 1440 and 390: every visible flag is a `button` that is
  focusable, with an accessible name that holds its point.
- **HV-L2.** After activating a flag (click at 1440, Enter at 390):
  - `#p-alarms` is visible and its tab is selected;
  - the Saved view reads `active`;
  - the result count equals the flag's `data-alarms` (54 and 1), which equals the records of `alarms()` for its point;
  - every row in the result shows the flag's point and a location under the current hall.
  - The same holds after normal → scenario → normal → scenario: a cleared alarm is not counted as active twice.
- **HV-L3.** In `normal` there is no flag and no chip, and the alarm list is untouched (Saved view still `all`).
- HV-S1, I1, I2, I3, M3, U1 and P2 stay green.

## 4 · Risks

- **R1.** The search box also matches message text. The filter word is the point (`PUMP-1`), which no fixture message
  holds today; HV-L2 checks that the count is exact, so a widened match turns the law red.
- **R2.** `datahallAI.html` is a shared page. This phase edits `js/datahall-ai/hall-iso.js` only, plus its test.

## 5 · Status

Built and gated on the v3.104.0 tree + E2 (75153cac2). Laws `tools/test-dcai-flag-list.mjs`: 62/62. Red first: 48 of 62 on
110084672 (flags were spans). The round-trip law then found a defect from A5b: after normal → scenario → normal → scenario, the
"Active alarms" view counted 108 PUMP-1 records for 54 alarms, and 2 for one leak. The journal keeps the old `active_unack`
record of an alarm that has since returned. Fix in `js/datahall-ai/operator-ui.js`: the Active view and the Active metric
count a record only when it is the latest record of its tag and point (ISA-18.2 state, not history). DC AI gate set 46/46.
