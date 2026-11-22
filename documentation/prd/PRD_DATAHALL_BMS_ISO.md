# PRD-DATAHALL-BMS-ISO — the data hall floor in 3D that still reads like a BMS

Status: **APPROVED 2026-11-22 (owner request R185 in the ledger; the draft called it R184).** Phases F0–F3 built in v3.89.0 (this
release); F4 (DC AI Data Hall tab) is next. Builder chosen by the owner ("kamu yg tentukan"). §8 lists where the build
differs from the draft, and why.

## 0. Context

**Owner, 2026-11-21 (R184):**
> "Kenapa tampilan UIUX datahall jadi 3d jadi kayak bukan BMS. Mksdnya yg floor plan dulu bentuknya 3d tapi
> sekarang flat"

When I asked which page and which direction, he answered:
> "Yg terbaik, rancang prdnya. Sempurnakan. Kamu yg tentukan"

**What I measured** (screenshots sent to the owner; files in `$S/cmp/`):

| page | v3.82.0 (this morning) | live v3.85.0 |
|---|---|---|
| `datahall.html` (Conventional) | flat column grid: a table of rows × racks with six numbers under each row | oblique 2.5D: 463 **green** extruded blocks, height = load (peer v3.83.0, PRD-CONV-DATAHALL-FLOOR FP2, from the owner's earlier "Floor plannya terlalu flat") |
| `datahallAI.html` → Data Hall tab | flat plan (fan walls, racks, CDU line) | the same flat plan |

**The two owner comments do not contradict each other.**
- In the morning, "terlalu flat" meant: the floor was a table, not a room.
- Tonight, "kayak bukan BMS" means: the 3D that replaced it is a 3D bar chart, not a BMS floor graphic.
- **Conclusion:** keep the depth, and make it look and read like a BMS.

**Why the current 3D reads "not BMS"** (each point checked on the live render, 1440 and 390, dark):

| # | gap | evidence |
|---|---|---|
| G1 | **Everything is coloured.** All 463 cabinets are green in a NORMAL hall. A BMS / high-performance HMI (ISA-101, the site's own HMI_DRAWING_STANDARD) draws normal equipment grey and spends colour only on abnormal states. | now-datahall-1440 |
| G2 | **Height is load.** Cabinets are extruded by kW, so the hall is a bar chart. In a BMS graphic a cabinet is a cabinet, all the same height; load is a value. | floor-plan.js `H_UNITS`, `h = kW/rating` |
| G3 | **No equipment detail and no values.** Equipment is boxes, CRAHs are flat trays, and the containment is not visible. There are no value tags, the boxed numerics a BMS puts at sensors. The only number on the plan is row kW under the slab. | now-datahall-1440 |
| G4 | **Heavy shear.** The 0.42 / 0.62 oblique turns rows into a parallelogram, so rows A–M and N–Y read as two slanted carpets. Row and rack identity is lost. | both widths |
| G5 | **Phone:** 463 blocks at about 4 px each make a green texture. Nothing is readable or tappable. | now-datahall-390 |
| G6 | **Nothing moves.** Air, the main thing a data hall does, is not drawn on the floor; it is only in the separate Air path view. The owner's R162 ("udara meniup, angin panas dari HAC") is still open. | — |

## 1. Decision (the "best" I choose)

**One floor, two projections of the same drawing:**
- **3D**: true isometric BMS graphic, the default at ≥ 600 px.
- **Plan**: orthographic top view, the default on a phone.
- A two-button toggle switches between them. It is remembered per page.
- Both projections carry the same element ids, points, selection and modes. Switching changes geometry only.

The BMS look comes from the following rules. Each one becomes a law in §4.

1. **Grey is normal (fixes G1).**
   - Cabinets, CRAHs, containment and floor are neutral ink faces in three lightness steps: top, left, right.
   - A cabinet or unit in **warn / alarm** gets its state token (`--rz-pt-warn/alarm`, `css/conv-point.css`) on its
     faces plus a state glyph beacon above it (▲ / ◆).
   - Selection uses the amber outline from the register accent.
   - The mode views (Power / Inlet temp / Margin / Alarms / Space) keep their existing `classify()` thresholds. They
     colour only the cabinets that are not normal in that mode; normal stays grey.
   - Magnitude is shown on demand: the value tags (rule 3), the tooltip and the row panel. It is never shown by hue.
2. **Equipment, not bars (fixes G2 and G4).**
   - **Projection:** true isometric, 30°, applied to a plan rotated so rows run along one iso axis. Each row is a
     straight line of cabinets with a readable letter at its head.
   - **Cabinets:** every cabinet has the same height, 42U, about 2.0 u. Each one has a door line and a top vent line.
   - **Spare cabinets:** outline only.
   - **Hot-aisle containment:** a roof panel at cabinet height with end doors. The roof is translucent ink, about
     10 %, with one hairline edge.
   - **Cold aisle:** perforated floor tiles drawn as a hairline grid.
   - **CRAH units:** taller boxes on the walls, each with a fan grille (1–2 circles) on the face, a status lamp, and
     the unit tag.
   - **Room:** the floor slab plus the north and west walls only, so nothing is hidden.
3. **Value tags (fixes G3).**
   - At each row head: a BMS-style boxed numeric tag, `A · 25.4 °C in · 36.4 °C hot`. This is the existing row point
     (`data-point`) moved, not new data.
   - Each running CRAH gets a tag with supply and return.
   - At 1440 the tags show at rest. Below 900 px they collapse into the row panel and the tooltip.
   - A tag in warn or alarm uses the point-status chip from `point-status.js`.
4. **Air that moves (fixes G6, closes the floor half of R162).**
   - Cold supply: short arrows rise from the perforated tiles in the cold aisles.
   - Hot exhaust: arrows rise into the containment roof and travel back to the CRAH return.
   - Arrow speed is bound to the airflow the model already computes (`zones[].airflow`, CRAH fan state). A stopped
     CRAH stops its arrows.
   - The peer's motion module drives this (`js/conv/motion.js`, `css/conv-motion.css`, v3.84.0).
   - It respects reduced motion and pauses off screen (existing helpers).
   - Arrows are hairline strokes: no glow, no gradient, no filter.
5. **Phone (fixes G5).**
   - Plan is the default below 600 px.
   - One row band per screen width, swiped sideways inside the panel. The page itself never scrolls sideways.
   - Each cabinet is at least 8 × 8 px. A tap on a row opens the existing row panel (44 px rows).
   - 3D stays available through the toggle.

**DC AI Data Hall tab:** it is flat today and has its own geometry: fan-wall galleries, CDU line, 440 liquid-cooled
racks.
- It adopts the same 3D / Plan toggle and the same BMS rules in phase F4.
- It goes through a geometry adapter, not a copy.
- Its data hall drawing (`js/datahall-ai/hmi-v2.js`) is mine.

## 2. Ownership and coordination

- `js/conv/floor-plan.js`, `datahall.html` and `tools/test-conv-floor-plan.mjs` belong to the Conventional session.
  The owner gave me the decision, so I build this.
- **Before F1:**
  - I send the other sessions one message: the owner's words, this PRD path, and the files I take.
  - From then until my push, they do not edit those three files.
  - Their gates are mine to pass.
- **Release order:**
  1. v3.86.0 Q1 (gate running now);
  2. this PRD's release;
  3. F4 DC AI.
- Before each push: fetch, and port if main moved (as done twice today).

## 3. Implementation

| piece | file | change |
|---|---|---|
| projection | `js/conv/floor-plan.js` | Replace the oblique `SHX/SHY` with a `proj` object: `iso` (30°, cos/sin table) and `plan` (orthographic). `render()` takes `opts.projection`, and a change rebuilds once. `paint(mode)` stays attribute-only. |
| geometry | `js/conv/floor-plan.js` | Constant cabinet height, door and vent lines, containment roof and doors, perforated tiles, CRAH with grille and lamp. Keep `GEO`, the row bands (`maxBands`, `watchHeight`), `select()`, keyboard cursor and `onBuild`. Split into `floor-plan.js` (API, paint, select) and `floor-plan-geo.js` (projection and solids) so each stays under 800 lines. |
| colour | `js/conv/floor-plan.js` palette() | Neutral face steps from the ink tokens. State steps only for warn / alarm. `classify()` is unchanged. Drop the 3-step magnitude lightness on the top face; magnitude goes to tags. |
| tags | `datahall.html` (via `onBuild`) | Move the existing row-head and CRAH points into SVG tags (`foreignObject`-free `<g>` with rect + text). Ids and `data-point` are unchanged, so the point-coverage ratchet holds. |
| air | `js/conv/floor-plan.js` + `js/conv/motion.js` hooks | One `<g class="fp-air">` per cold and hot aisle. Arrow dash offset is animated by CSS custom property `--fp-air-speed` set from the model. The existing reduced-motion and off-screen pause apply. |
| toggle | `datahall.html` view bar | `3D` / `Plan` segmented buttons (`aria-pressed`). Memory key `rz.dh.proj` (try/catch). Phone default is Plan. |
| standards | `HMI_DRAWING_STANDARD.md` new §4f "floor graphics" | grey normal, equal equipment height, value tags, iso / plan toggle, air motion bound to data. `SITE_CHROME_STANDARD` unchanged. Same release. |
| PRD doc | `documentation/prd/PRD_DATAHALL_BMS_ISO.md` | This file, committed with the release. The peer PRD-CONV-DATAHALL-FLOOR gets a "superseded in part (P2 height, P3 oblique) by PRD_DATAHALL_BMS_ISO" note. |

**Reuse, not rebuild:**
- `classify()`, `select()`, the row panel, `RZPointStatus` chips, `RZConvShell` Details;
- the motion helpers in `js/conv/motion.js`;
- the signed-in audit harness (`tools/lib/signed-in-supabase.mjs`, `tools/lib/cockpit-audit-state.mjs`).

## 4. Laws (gate: extend `tools/test-conv-floor-plan.mjs`; rendered, authorized audit state, 1440 and 390, both themes)

| law | claim | red today |
|---|---|---|
| B1 | NORMAL hall: ≥ 95 % of cabinet faces are neutral (OKLCH chroma < 0.03); every coloured cabinet is warn, alarm or selected | 463 / 463 green |
| B2 | In 3D every occupied cabinet's front face has the same height (± 0.5 px); a load change moves no geometry | heights vary with kW |
| B3 | 3D axes measure 30° ± 1°; each row letter is ≥ 11 px and sits at its row head | 0.42 / 0.62 oblique |
| B4 | At 1440 every row has one value tag carrying its existing `data-point` ids, and every running CRAH has a supply / return tag; on a planted warn the tag shows the point-status chip | no tags |
| B5 | Air arrows exist per aisle; their speed follows airflow (perturb a CRAH off → its arrows stop); reduced motion = 0 running animations; off-screen = paused | no air |
| B6 | At 390: default projection is Plan, cabinets ≥ 8 px, page scrollWidth = 390, a tap on a row opens the row panel | 4 px blocks |
| B7 | The toggle works by keyboard (Enter / Space), is remembered across reload, and keeps the selected rack selected after a switch | new |
| B8 | Guard: point-coverage, conv shell, cockpit quiet, a11y (0 serious), dark coverage, `run-conv-release-gates.sh` all green. Only the floor-plan laws that encode the superseded P2 / P3 are rewritten; this is stated in the commit, and no ratchet is re-recorded. | — |
| B9 | Eye: before / after at 1440 and 390, dark and light, 3D and Plan, at rest and with a planted alarm; I look at each and send them | — |

Red before green: B1–B7 run on today's tree first and the red output is quoted. B1, B2 and B5 also go red on a planted
mutation (a green normal colour, height = load, a constant arrow speed).

## 5. Phases

| phase | content | proof |
|---|---|---|
| F0 | gate laws B1–B7 added, red on live v3.85.0 tree | quoted fails |
| F1 | iso projection + equal-height equipment + grey normal + containment / CRAH detail | B1–B3 green |
| F2 | value tags + air motion | B4, B5 green |
| F3 | Plan projection, toggle, phone | B6, B7 green; B8 full |
| F4 | DC AI Data Hall tab: same toggle + rules through a geometry adapter (fan walls, CDU line, liquid racks) | B1–B7 on `datahallAI` Data Hall; test-dh-hall / dh-vfx / dcai-points green |

F0–F3 ship as one release; F4 ships as the next one.

## 6. Risks

| risk | mitigation |
|---|---|
| peer edits floor-plan.js mid-build | message first; fetch before push; port if needed |
| iso with 500 cabinets is slow to build | the build stays once per width / projection; paint is attribute-only (existing rule); measure build ms at 1440 before and after, budget ≤ 1.5× today |
| tags clutter the 3D | tags only at row heads (25) and CRAHs; hidden < 900 px; Q-L2 of cockpit-quiet still counts words above the drawing, not inside |
| headless SVG animation cost (memory: SVG repaint traps) | dash-offset CSS animation on ≤ 50 paths; pause off screen; no filter |

## Verification

1. **F0:** `node tools/test-conv-floor-plan.mjs` on the current tree → B1–B7 red (quote).
2. **After F3:**
   - the same gate is green;
   - `bash tools/run-conv-release-gates.sh`;
   - `node tools/test-cockpit-quiet.mjs`;
   - `test-conv-point-coverage`;
   - a11y and dark coverage;
   - then the full `tools/ship-gate.sh` on lane 3 / 4.
3. **Live after push:**
   - the signed-in-stub screenshot script (`$S/cmp-shot.mjs`), datahall.html at 1440 and 390, dark and light, 3D and
     Plan, with a planted alarm;
   - I look at every image and send the before / after pairs to the owner;
   - ledger R184 gets the sha.

## 8. As built (F0–F3), and where the build differs from the draft

| draft | built | why |
|---|---|---|
| normal equipment fully grey | grey body **plus a green status lamp** on every occupied cabinet and running CRAH; warn / alarm paint the whole body in the state token | owner C8 (HMI_DRAWING_STANDARD §4d): "jangan abu-abu semua … hijau, orange atau merah tergantung kondisi". The lamp answers C8; a grey body stops the hall reading as a green bar chart (R185). |
| row tags at the row heads (north end) | the row letter and its value tag are one boxed tag in the screen column of each row's head in 3D, its foot 2.15 u above the head's roof; the strip under each band in Plan | one element per row keeps FL10 (≤ 30 numbers on the plan) and the existing `.zone` / `.zone-head` hooks. A tag right over the head covered the north CRAH gallery and took its clicks (FX3: a CRAH click selected a row); a tag on the north wall sat nearer the next row (B3). The north gallery's roof edge rises 1.9 u above the head in that column, so 2.15 u clears it and keeps the tag nearer its own row. |
| normal numbers in ink | a point's text keeps its state colour, green when normal, as on every other cockpit | `test-conv-point-coverage` PC3 holds every point to its state token; the floor's own FL7 now leaves `[data-pt-state]` text to PC3. It also answers C8 (green by condition). |
| one tag per running CRAH | one CRAH tag for the hall: running average leaving air → return air | 59 tags over the galleries would bury the drawing (owner R182 chrome budget). Each unit's own values stay in its tooltip and inspector. |
| tags hidden below 900 px | the row tags stay at every width | the tag replaced the old strip number, which was already shown at every width |
| B5 red today (no air) | B5 was already green (peer PRD-CONV-BMS-LIVE, v3.86.x). Its red proof is a mutation: a constant air speed fails the heat → speed law | the draft was written before that release |
| a `floor-plan-geo.js` split | `js/conv/floor-plan-color.js` (the OKLCH arithmetic) is split out instead | the projection is spread through build(); the colour maths is the self-contained part. Both files stay under 800 lines. |
| build time ≤ 1.5× | 96 → 123 ms median (1.28×), a controlled A/B in one browser on one lane, before the lamps | the 463 lamps add 500 SVG nodes (4,128 → 4,628); a single run after them reads 87.5 ms render, 115.8 ms with layout |

Superseded laws in `tools/test-conv-floor-plan.mjs`:
- FL3 "every occupied cabinet is green" is now "no cabinet of the NORMAL scenario reads warn or alarm".
- FL5 "height monotonic in kW" is retired. Its spare-cabinet rule stays.
- FL7 (no coloured text) no longer judges a point's text (`[data-pt-state]`); PC3 of the point-coverage gate does.
- `test-operator-cockpit-regressions.mjs`: the 25.x °C cabinet check ("green side of the ramp", v2.10.0) now reads a
  neutral body and a green lamp. Same invariant; red on the v3.88.0 floor, green on this release.

Red proofs by mutation: a green normal fill fails B1 (0 of 463 cabinets neutral); a load-scaled height fails B2
(front heights 39.2 to 41.2 px); a constant air speed fails B5.

No ratchet was re-recorded.
