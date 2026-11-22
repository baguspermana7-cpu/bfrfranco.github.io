# PRD-TREND-CHART-DESIGN — trend charts that read like an instrument, not a template

Status: **APPROVED 2026-11-21 (R181).** Committed with this PRD as `documentation/prd/PRD_TREND_CHART_DESIGN.md`.

## 0. Context

Owner, 2026-11-21:
> "Warna chart sangat ai design slop dan uiuxnya, design prdnya. Find a gap. And improve"

**The chart in question.** The trend modal `js/rz-trend.js`, which opens on a click on any point. It is live on
chiller-plant, fire, fuel, water, EPMS and cdu-mini-bms.

**Two versions are in play.**
- **v1, live today.** Screenshot `$S/chart/conv-trend-dark.png`.
- **v2.0.0.** Owned by the Conventional session, branch `conv-t23` (671323456), not yet live. It adds 1H…30D,
  limit bands and a state header. Rendered locally in `$S/chart/v2-chiller-plant-{1440,390}-{1,multi}.png`.

v2.0 **keeps the same pen palette and adds new gaps**, so fixing only v1 would be wasted. This PRD targets v2.0.

**The DC AI equipment modal has its own small trend** (`js/datahall-ai/hmi-v2.js` `trend()`, "Trend, last 24 h").
That one is mine and has its own gaps (§1, G12–G14).

## 1. Gaps found, measured

| # | gap | evidence |
|---|---|---|
| G1 | **The pen palette is GitHub-Primer dark** (`#56c2f5 #e8b563 #3fb950 #f0883e #d2a8ff #ff7b9c #8b93a1 #79c0ff`). It is the template palette the owner reads as slop. | `rz-trend.js:47-48` |
| G2 | **The palette fails the colour validator.** It fails 3 of 5 checks on the dark surface: lightness band, chroma (`#8b93a1` reads grey), and CVD. The worst pair is `#8b93a1↔#ff7b9c`, ΔE 1.2 for protan readers, so they cannot tell those pens apart. | `validate_palette.js --mode dark` output |
| G3 | **Pens reuse the state colours.** Pen 2 amber = the warning amber (`--rz-pt-warn #e8b563`), pen 3 green = the normal green (`#3fb950`), and pen 4 orange sits next to the alarm red. A compare pen therefore reads as a state. | `conv-point.css:7-9` vs `PEN` |
| G4 | **There are purple pens** (`#d2a8ff`, light `#5b3d99`, hue ≈ 270°). This is inside the owner's banned hue band [238°, 310°]. The purple gate does not catch it, because it never sees colours that exist only inside a JS array. | v2-multi screenshot (lavender pen) |
| G5 | **Two y-axes**, plus pens "scaled to its own range" that have no axis at all. With multi-pen, an L/s line crosses the °C HH 22.4 alarm band and looks as if it were in alarm. A dual axis is the number-one chart anti-pattern. | v2-multi 1440 + 390 |
| G6 | **Y ticks are not round numbers, and they duplicate.** v1 prints 19.4 / 19.4 / 19.3 / 19.3 / 19.3. v2 prints 22.9 / 21.1 / 19.4 / 17.7 / 15.9. The cause: 5 equal splits of lo…hi, rounded to the point's digits, instead of nice steps. | `rz-trend.js:328-335`; both screenshots |
| G7 | **The scale is set by the alarm limits, not by the data.** The 1D CHWS line (18.8–20.0 °C) uses one quarter of the plot height. The detail the reader opened the chart for is flattened, while 75 % of the area is red or amber wash. | `layout()` adds `L0` limits to min/max |
| G8 | **The band washes are muddy.** A maroon tint fills the top and bottom of the plot, and normal is a green-grey tint. Together they look like a heatmap rather than a calm instrument. | v2-1 |
| G9 | **The line is jagged.** It joins every simulated sample with straight segments, so the noise reads as a zig-zag (v1 1h). No min–max envelope is shown for short ranges. | v1 screenshot |
| G10 | **X ticks fall at odd times** (05:54, 11:54, 17:54). They are anchored to "now", not to clock hours. | v2-1 |
| G11 | **The phone layout is cramped.** The plot is about 220 px tall; the six stat tiles take more height than the plot; the series table is cut off at the right; the "L 17.9" label sits under a pen. | v2-chiller-390-multi |
| G12 | **The DC AI trend is a mislabelled sparkline.** It always shows CDU ΔP, whatever was opened, with a fixed aria-label "CDU differential pressure". It has 48 stretched points (`preserveAspectRatio="none"`), no value axis, no limits and no time ticks. | `hmi-v2.js:795-812` |
| G13 | **The DC AI trend is not the shared modal.** It cannot be clicked into ranges or compare (PRD-DCAI-NUMBERS §5 planned this; not built). | same |
| G14 | **There is no chart-colour gate.** Nothing checks pen colours against the validator, the state reservation or the purple band. That is why G1–G4 shipped green. | `tools/` (no such test) |

## 2. Design: the "instrument" register (ISA-101 high-performance trend)

The principle: **colour on a trend is information, never decoration.** The plot is quiet grey; the pen you opened
is the only strong thing; state colour appears only where a value is in a state.

### 2.1 Pens (fixes G1–G4)

**Pen 1** (the point opened) is **ink**: the text colour, 2 px wide.
- Dark `#e8edf5`, light `#1b2430`.
- It is the most legible line on the plot and carries no meaning-colour.

**Compare pens** use **3 validated hues, in fixed order, never cycled**. Each also has its own dash, so it never
relies on colour alone.

| slot | dark | light | dash |
|---|---|---|---|
| 2 | `#3b6ac5` (steel blue) | `#2552aa` | solid |
| 3 | `#bf5884` (rose) | `#ab366e` | 6 3 |
| 4 | `#31ab95` (teal) | `#039580` | 2 3 |

- Generated in OKLCH. `validate_palette.js --pairs all` gives **ALL CHECKS PASS** in both modes.
- The only WARN is CVD deutan ΔE 6.1 (dark) and 7.0 (light), which the validator allows *only with secondary
  encoding*. The dash and a direct end-label provide it.
- Exact steps may be re-snapped in build; the gate (law C1) is the contract.

**Maximum 4 pens** (1 + 3 compare); today the maximum is 8.
- A 5th compare is refused, with the sentence "Up to 4 lines. Remove one to add another."
- More pens than this cannot be told apart on one plot, and the non-negotiable rule says never generate a 9th hue.

**Banned for pens:**
- the state hues (green ok, amber warning, red alarm, and orange next to red);
- the purple band [238°, 310°];
- neon (OKLCH C > 0.2 at L > 0.75).

### 2.2 One axis (fixes G5)

- **Same unit:** all pens share one left axis.
- **A compare pen with a different unit:** the plot switches to **stacked small multiples**. Each unit gets its
  own strip with its own axis and unit label, the strips share one time axis, and one cursor runs through all of
  them. No right axis. No "scaled to its own range".
- **Limit bands** are drawn only in the strip of the point they belong to.

### 2.3 Scale and ticks (fixes G6, G7, G10)

- **Y range = the data in view**, plus 8 % padding.
- **A limit outside that range** is not stretched to fit. It shows as an edge marker on the axis: "▲ H 20.9" at
  the top with a short arrow.
- A **"Show limits"** toggle (key L) extends the range to the limits for the reader who wants the whole envelope.
- **Y ticks** are nice numbers: step ∈ {1, 2, 2.5, 5}×10ⁿ, 4–6 ticks. They are never duplicated; the label digits
  follow the step, not the point.
- **X ticks** fall on clock boundaries:
  - 1H every 10 min;
  - 8H every 1 h;
  - 1D every 3 h (00:00, 03:00 …);
  - 7D at local midnight each day;
  - 30D every 5 days.
- Time zone shown once (GMT+7).

### 2.4 Bands and states (fixes G8)

- **Normal:** no fill at all.
- **Warning:** a hairline amber limit line plus a 4 % amber fill outside it.
- **Alarm:** a red line plus a 6 % red fill.
- Limit labels sit in the right gutter, outside the plot, so they never collide with a pen (G11 overlap).
- **Where the pen itself is in warning or alarm**, that run of the line is drawn in the state colour with a ▲/◆ marker
  at the entry. This is the one place colour on a line means something.

### 2.5 Line (fixes G9)

- **Up to 1 point per pixel:** a step-after line (`stepAfter`). It shows sampled values the way a historian holds
  them and reads calmer than a zig-zag.
- **Denser than 1 point per pixel** (8H and longer): the min–max envelope (10 % fill of the pen colour) with the
  average line on top. v2 already does this for buckets; it is extended to raw data when points per pixel > 1.

### 2.6 Chrome and phone (fixes G11)

- Header: name, big value in its state colour, state word, SIM badge. All of these exist; the SIM badge loses its
  pink-red frame and becomes neutral outline.
- The stats strip becomes one row of 4 (Min · Max · Mean · Time off-normal). "Excursions" moves into the tooltip.
- The series table is shown only when there are 2 or more pens; it replaces the strip.
- **Phone (≤ 600 px):**
  - plot height ≥ 50 % of the sheet (≈ 360 px);
  - stats as a 2 × 2 grid under the plot;
  - series table as stacked rows with no horizontal scroll;
  - range buttons ≥ 44 px.

### 2.7 DC AI trend (fixes G12, G13)

- The modal's 24 h sparkline is replaced by a "Trend" button row: each live point of the equipment opens the
  shared modal (v2 with §2.1–2.6) through a DC AI history provider. This is PRD-DCAI-NUMBERS B4.
- Until then, the sparkline is fixed in place:
  - it draws the point it names (the first banded point of the equipment), with its name and unit in the label;
  - a real aspect ratio;
  - 3 y ticks and 4 time ticks, nice values;
  - limit lines from `RZDatahallAIPoints`;
  - the same ink and band rules.

## 3. Ownership and order

`js/rz-trend.js` 2.0 belongs to the Conventional session (`conv-t23`, mid-rebase now). My earlier cross-session
messages expired undelivered because our permission modes differ.

1. **T-C0** (theirs). They ship v2.0 as it is. I do not touch their branch.
2. **T-C1** (this PRD, built on top of v2.0 once it is on main).
   - A palette and design pass inside `rz-trend.js`, for §2.1–2.6.
   - Additive only: the API, the hash format and the provider option stay unchanged.
   - Their gates (`test-conv-vfx-trend`, `test-conv-trend-ranges`, point-status) must pass before my push. Any check
     that pins an old pen colour is updated in the same commit, with the reason.
   - **The owner tells the Conventional session** that T-C1 follows their release, or approves that I do it.
     Peer-owned files have been read-only to me until now.
3. **T-C2** (mine, can start now). The DC AI sparkline fix (§2.7 interim), plus the new gate `test-chart-colour.mjs`
   (law C1–C4), which also guards DC AI charts.
4. **T-C3** (mine). DC AI points open the shared modal (PRD-DCAI-NUMBERS B4).

## 4. Laws (each red on today's tree first)

| law | claim | proof command | red today |
|---|---|---|---|
| C1 | **Validated palette.** The pen palette passes `validate_palette.js --pairs all` in dark and light. | `node tools/test-chart-colour.mjs` | 3 FAIL (G2) |
| C2 | **State colours reserved.** No pen hue is within ΔE 15 of the ok, warn or alarm token, and none sits in the purple band or the neon zone. | same | amber, green, lavender pens |
| C3 | **One axis.** No rendered trend has a right-hand value axis; a mixed-unit compare renders N strips. | browser gate on chiller-plant, compare °C + L/s | right axis present |
| C4 | **Nice, unique y ticks; clock-aligned x ticks** at every range. | browser gate, 5 ranges × 3 points | 19.4, 19.4 duplicates; 05:54 |
| C5 | **The data fills the plot.** The data span is ≥ 55 % of the plot height when limits are off-scale (default view). | browser gate | 1D CHWS ≈ 25 % |
| C6 | **Phone fits.** At 390 px: plot ≥ 340 px tall, no horizontal scroll, no limit label overlapping a pen, buttons ≥ 44 px. | browser gate | plot ≈ 220 px, table clipped |
| C7 | **Honest DC AI sparkline.** Its label names the point drawn; it has y and x ticks and limit lines. | `test-dh-hall` extension | fixed "CDU differential pressure" |
| C8 | **Owner sign-off by eye.** Screenshots at 1440 and 390, dark and light, single pen and 3-pen compare, before and after, side by side, sent to the owner. | `SendUserFile` | — |

## 5. Verification

- Red: run `test-chart-colour.mjs` and the browser gate on `origin/main` (v1) and on the v2.0 tree, and quote the
  failures.
- Green: the same commands on the build tree.
- The full `tools/ship-gate.sh`, push, then live on resistancezero.com:
  - open chiller-plant CHWS at 1H / 1D / 30D;
  - compare CHWR (same unit) and flow (different unit → strips);
  - repeat at 390 px;
  - on the DC AI Cooling tab, open a CDU and check its trend.
- Screenshots looked at and sent. Rows in `OWNER_REQUESTS_STATUS.md` (new R-id).

## 6. Meanwhile (not blocked by this PRD)

- The v3.82.0 ship gate keeps running on `wt-dcai-port`, then push and live check, as already approved.
