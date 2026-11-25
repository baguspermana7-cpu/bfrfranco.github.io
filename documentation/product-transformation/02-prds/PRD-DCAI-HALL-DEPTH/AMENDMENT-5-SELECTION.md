# PRD-DCAI-HALL-DEPTH — Amendment 5: the unit you opened stays selected (phase A5d)

Owner, standing: "Continue improve more"; "animasi state, indikasi banyak yg belum ada". Amendment 1 §8.3 asked:
"Click/Enter selects a unit: 2 px ink outline (not colour) … the same unit stays selected across a view switch", and §9:
"Enter opens the HMI". Amendment 3 §2 deferred both.

## 1 · What is wrong (measured on v3.106.0 candidate a1c01cecf, 1440 and 390, 2D, probe `~/.cache/qa-tmp/sel/probe.mjs`)

| # | Measured | Should be |
|---|----------|-----------|
| F1 | A click on CDU-07, CRAH-03 or rack R03-05 opens its HMI (`cdu-hmi`, `crah-hmi`, `rack-modal`). After the HMI closes, nothing marks the unit: the floor's selection ring stays hidden and no element carries `data-sel`. | The unit stays selected after its HMI closes. |
| F2 | Cause of F1: `equipment-inspector.js` takes every `[data-rz-equipment]` click in the capture phase and stops it, so the floor's own click handler (which selects) never runs. | The floor hears the activation. |
| F3 | The floor's ring, when it shows, is the accent amber at 1.5 px: the same hue as the warning state. | 2 px ink outline, never a state colour. |
| F4 | Keyboard: focus the floor, an arrow key, Enter → nothing opens (the floor selects internally, no page hook opens the HMI). | Enter opens the same HMI as a click. |
| F5 | Lens switch and 2D ↔ 3D keep nothing, because nothing is selected. | The same unit stays selected. |

## 2 · Design

- **C1 — One activation event.** `equipment-inspector.js` dispatches `rz-equipment-activate` (`detail.ref`) on the unit it
  opens, for a click and for Enter. The Data Hall floor (`hall-iso.js`) listens on its host and selects that unit. The
  HMI opens exactly as before; the event only adds the selection.
- **C2 — Enter opens.** `hall-iso.js` passes `onRack` / `onCrah` to the floor; they give the unit under the cursor the
  same click, so the one resolver opens the one HMI.
- **C3 — Ink, 2 px.** `floor-plan.js` opt-in `selInk`: `.fp-ring-sel` uses `--fp-ink` at 2 px, and the selected row head
  border is ink. The Conventional `datahall.html` does not pass it and keeps its accent ring.
- **C4 — Held.** `hall-iso.js` already carries `inst.sel` across a lens repaint and a 2D ↔ 3D render (HV-V3); in 3D the
  ring is the unit's top face.
- **C5 — Cleared.** Escape on the focused floor clears the selection (the floor's existing key). A fresh load selects nothing.
- **Not in this phase.** The pinned inspector / bottom sheet of §8.3: a click opens the HMI modal by the owner's
  2026-09-07 decision (equipment-inspector v2.3.1), so a second panel would compete with it. STALE lamps (§8.1) are
  phase A5e: they read the replay's missing samples. MAN lamps are not built: DC AI has no hand/auto source, and a lamp
  without one would be fake.

## 3 · Laws (`tools/test-dcai-select.mjs`)

- **SL1.** 1440 and 390, 2D: a click on `cdu:7`, `crah:03`, `rack-unit:R03-05` opens `cdu-hmi`, `crah-hmi`, `rack-modal`;
  after Escape the selection ring is shown, its centre lies inside that unit, its stroke is the computed `--fp-ink`, and its
  width is 2 px. No page error.
- **SL2.** The rack stays selected after Thermal, 3D and back to 2D.
- **SL3.** Focus the floor, ArrowRight, ArrowDown, Enter: an HMI opens for the unit under the cursor; after close it is selected.
- **SL4.** A fresh load selects nothing; Escape on the focused floor clears the selection.
- **SL5.** `datahall.html` (Conventional) keeps its ring: accent, 1.5 px.

Red on a1c01cecf: 22 of 45 (SL1 ring hidden and amber 1.5 px; SL2; SL3 Enter opens nothing). Green: 45 / 45.

## 4 · Risks

- **R1.** `js/conv/floor-plan.js` is shared with `datahall.html`: the change is one opt-in attribute and two CSS rules
  under it. SL5 guards the default.
- **R2.** `equipment-inspector.js` serves every DC AI tab. The new event bubbles from the unit; a listener elsewhere would
  see it, none exists today (`grep rz-equipment-activate`).

## 5 · Status

A5d built 2026-11-25 on a1c01cecf. Screenshots read: 2D 1440 (CDU-07 ink outline), 2D 390, 3D 1440 (rack top face,
ink row head), light 1440 (rack R03-05 dark-ink outline).
