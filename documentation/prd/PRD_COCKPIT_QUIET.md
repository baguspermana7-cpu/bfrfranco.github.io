# PRD-COCKPIT-QUIET v2 — the drawing is the page, everything else one level down + total audit of the owner's comments

Status: **APPROVED v2, 2026-11-21 (R182, R183). Q1 builder: me.** v1 was approved and Q0/Q2 are built locally
(WIP 8688b175a on branch `cockpit-quiet`, not pushed). This version extends it to every cockpit and adds Part B,
the audit of every open owner comment. Nothing more is executed before approval.

---

## 0. Context

**Owner, 2026-11-21**, on a phone screenshot of `chiller-plant.html` with four areas marked in red:
> "tulisan2 yg over yg mana tidak berguna dan saya bisa lihat di mimic ui nya … cari2 yg seperti ini sejenisnya.
> Nggak perlu di tampilkan. Kan sudah aku bilang dibuat hirarki yg di hide/expand. Rancang prdnya, audit total"

Then:
> "Complete the task, sebelum eksekusi rancang prdnya dg sangat comprehensive. Audit total comment saya semua
> pastikan sesi lain aware juga"

**Three asks:**
1. Finish R182 on every cockpit, including the 7 Conventional ones he screenshotted. This is Part A.
2. Audit **all** his open comments against what is really on main and live. This is Part B.
3. Make the other sessions aware. This is Part C.

**What already happened:**
- **The hierarchy is not new.** On 2026-11-12 he asked for "less visible text, more tooltips"
  (memory `feedback_less_visible_text_tooltips`). The peer's PRD-CONV-DATAHALL-SPACE applies the same idea, but to
  `datahall.html` only; its §4 leaves "other cockpits" to a later PRD. **This is that PRD.**
- **v1 measured the problem live and built Q0 + Q2:**
  - the gate `tools/test-cockpit-quiet.mjs`, red on today's tree;
  - DC AI and cdu-mini-bms, now green.
- **8 existing gates stay green** on the Q2 tree: dcai-coverage `--strict --settle --modals`, dcai basis hooks,
  dh-hall 120/0, conv point coverage, conv shell 535/0, operator regressions, telemetry docs, provenance.

---

# Part A — the cockpit chrome hierarchy (R182)

## A1. Audit, rendered (local tree = origin/main v3.82.0 + my unpushed work; 1440 × 900 and 390 × 844, dark)

`drawTop` is the y of the main drawing's first pixel. "Words" are counted above the drawing, in its column, not
counting the cockpit bar and sheet tabs.

| cockpit | drawTop 1440 / 390 | words 1440 / 390 | repeated or useless at rest (source element) |
|---|---|---|---|
| chiller-plant | 453 / 766 | 119 / 123 | `.sub` subtitle "ISA-5.1 P&ID · CHW primary header", truncated; `header.bar` toolbar box: 58 px tall, 1420 px wide, holding SIM / MAINT / Ack only; telemetry banner + `p.rz-prov`; `#alarmStrip` ticker (CHWS / CHWR / ΔT / L/s / duty / scenario); `section.ops-context`: hall selector + two `basis-card` (authority, capacity study); `.legend` chip row (`#lgChws` / `#lgChwr` = values drawn at TT-CHWS / TT-CHWR, plus Run / Warn / Alarm = second legend) |
| water-system | 678 / 987 | 151–185 | toolbar (Fullscreen / Export); banner; `p.rz-prov` "conv-engine.js scenario; data quality = …"; clock / quality / scenario; 2 basis cards; 6 KPI cards |
| fire-system | 440 / 840 | 138–146 | toolbar; banner; `p.rz-prov`; scenario |
| fuel-system | 616 / **1508** | 175–186 | tag line; SIM card + Stale Pts + Since render; `p.rz-prov` "conv-engine.js bulk fuel model…"; banner; 6 KPI cards (Generator autonomy, usable fuel, consumption) before the drawing |
| EPMS_Telemetry | 347 / 498 | 112–144 | banner (3 slots); `p.rz-prov`; scenario |
| ict | 458 / 972 | 127–131 | banner; `p.rz-prov`; page clock; scenario × 2 |
| datahall | tabs | 954 | **excluded**: the peer's PRD-CONV-DATAHALL-SPACE (their v3.83.0 `1f702013a` "The data hall gets the screen", committed in rz-fp2, not pushed). Q0 covers it once that is on main. |
| dc-conventional | hub | 368 | banner; `p.rz-prov`; clock × 3; 33 KPI cards (hub). The hub is a portfolio page, not a mimic, so it gets the text rules (R2–R4) but not the drawTop law. |
| cdu-mini-bms | 1529 / **2612** → **191 / 269** | 340 → 22 | done in Q2 |
| datahallAI | 179 / 418 → **169 / 203** | 87 → 7–10 | done in Q2 (8 KPI cards, 7 of them repeated on the picture callouts) |

### A1b. What sits above each drawing at 1440, and where it goes

Source: `documentation/prd/PRD_COCKPIT_QUIET.chrome-map.json`; `hooks` counts id / data-point / data-basis-param.

| page | row (y, height, words) | → level |
|---|---|---|
| chiller | `header.bar` y58 h58: SIM / MAINT / Ack | L1 control row; box removed |
| | telemetry banner y124 h45 | state chip (L0); text in tooltip (L2) |
| | `#alarmStrip` y177 h36 w31, 13 hooks | state + counts → chip; CHWS / CHWR / ΔT / L/s (drawn at TT-CHWS / TT-CHWR) → L1; duty, redundancy → L1 |
| | `section.ops-context` y221 h68 w60: hall selector + 2 basis cards | L1 (hall selector first inside Details) |
| | `.legend` y350 w16: `#lgChws` / `#lgChwr` + Run / Warn / Alarm | L1 (values); the legend words are already in `.vfx-bar` → drop the duplicates |
| | `.sub` subtitle in the bar | title tooltip |
| water | `div.topbar` y62 h62: Fullscreen / Export | L1 control row |
| | banner; `#alarmStrip` (stale points, page clock, scenario) | chip + L2 |
| | `p#rz-prov-water-strip` "conv-engine.js scenario; data quality = …" | L2 (chip tooltip) |
| | `section.ops-context` basis cards | L1 |
| | `div.kpi-grid` y322 **h225**, 10 hooks | L1 (WUE already in the reconciliation panel beside) |
| fire | `div.flex` "Basis: IT 30 MW · Fullscreen · Export" | L1 |
| | banner; `#alarm-strip` (FACP state + reserve deficit, 17 hooks) | the state stays at L0 in the chip (WARN: reserve deficit); the rest → L1 |
| | `p.rz-prov` | L2 |
| | `#fire-stages-legend` (0–4 stages) | L1: it is a legend of the drawing's stage colours, and the view bar keeps a "Stages" toggle |
| | `section.fire-scope-strip` | L1 |
| fuel | `header.topbar` y48 **h103** w43 (tag line + SIM card + Stale / Since render) | chip + L2 |
| | `section.kpi-strip` **h125** (autonomy, usable fuel, consumption) | L1. Exception: "Generator autonomy 48.0 h" is the page's headline number, so it moves to the chip row as one L0 figure. |
| | scope strip | L1 |
| | `#fuel-hallbar` | stays L0: it is the drawing's selector |
| | `p#fuel-dt-basis` | L2 |
| EPMS | `#epms-status-strip` y48 h87 w63, 16 hooks (load, PUE, utility) | L1; state → chip |
| | banner | chip |
| | `div.topbar` (Panels / HV-MV / LV / Export) | stays L0: these are the sheet tabs |
| | `p#epms-sld-msg` | L2 |
| ict | `div.topbar` (Basis / Quality / Print / Export) | L1 + L2 |
| | banner; `#alarmStrip` | chip |
| | `#ict-ops-strip`, `#ict-otgw` | L1 |
| | `p.rz-prov` | L2 |
| | `.svc-strip` | L1 |
| | `.arch-toolbar` (scenario) | L0: it is the drawing's control |
| datahall | banner, `#alarmStrip`, `p.rz-prov`, `#dh-ops-rollup` | the peer's DATAHALL-SPACE already moves them (hall bar + chip) |
| hub | `header.header` "Ask FAQ" + banner | chip; the hub body stays |

**Gate fixes found while mapping (applied in Q1a):**
- `.hmi-bar` (sheet title + Find) and `.vfx-bar` (view + legend) are L0. The word count must exclude them.
- `<select>` option text must not count. The EPMS hmi-bar otherwise reads 208 words because of its Find list.

**The nine patterns** (each one is a rule in A2):

| # | pattern | where |
|---|---|---|
| P1 | the same value 3–4× (ticker, chip, drawing, side panel) | chiller, water, fuel, DC AI |
| P2 | SIM banner + explainer sentence on top of a SIM toggle | 9 of 10 |
| P3 | developer prose (`p.rz-prov` basis text with file names and "x = …" definitions) | 8 |
| P4 | meta status (page clock, scenario, stale points, data quality, "Updated 8s") | 8 |
| P5 | planning / basis cards above the drawing | chiller, water |
| P6 | a second legend (chip row) right above the view-bar legend | chiller (CH-M-101/102) |
| P7 | a framed toolbar box that is mostly empty | chiller, water, fire, EPMS, ict |
| P8 | a subtitle cut mid-word | chiller, others at 1440 |
| P9 | KPI cards or an article hero in front of the drawing | fuel, water, cdu (fixed), DC AI (fixed) |

## A2. Design — three levels, one pattern for every cockpit

| level | content | element |
|---|---|---|
| **L0 at rest** | the cockpit bar (Back · title · **state chip** · CTA · login · theme · clock); sheet tabs; the view bar with its ONE legend; the drawing; the inspector at ≥ 1100 px | existing `.cv-bar` (shell), sheet switch, `.view-bar` |
| **L1 one tap** | "Details ▾" directly under the bar: (a) numbers that are NOT on the drawing (ticker remainder, duty, redundancy); (b) the hall selector and basis / capacity cards; (c) KPI cards (fuel, water); (d) SIM / MAINT / Ack / Fullscreen / Export as a compact control row | `<details class="cv-details" data-cockpit-details>`; closed at rest; open state remembered per page in `localStorage` (try/catch) |
| **L2 hover / focus / tap** | the explanations (provenance basis, scenario, data quality, page clock, stale points, subtitle, SIM meaning) | ⓘ tooltip on the state chip through `RZExplain`; the existing basis drawer (`data-basis-param`); provenance `p.rz-prov` moves into the chip's tooltip panel (still in the DOM, still one per cockpit) |

**The state chip (new, in the shell).** One chip in the bar replaces the banner, the ticker's state word and the
SIM label: `● NORMAL · SIM · 0/0`, coloured by the worst alarm.
- Its text is the alarm state; its tooltip is the provenance line, the scenario, the data quality and the clock.
- The SIM / MAINT toggles stay reachable in Details (L1). The chip itself is not a control.

**Rules.** These go into `HMI_DRAWING_STANDARD.md` §4e (written in v1) and `SITE_CHROME_STANDARD.md` §9:
- **R1. Say each fact once at rest.**
  - A value drawn on the mimic is not repeated above it.
  - `#lgChws` / `#lgChwr` keep their `data-point` spans but move into Details.
  - The chip row keeps only what the view-bar legend lacks, so on chiller it disappears.
- **R2. No file names, code identifiers or "x = …" definitions in visible text.** The provenance basis text is
  shown only in a tooltip.
- **R3. No framed box without content.** The toolbar box is removed; its three controls go into Details.
- **R4. Nothing is deleted.**
  - Every id, `data-point`, `data-basis-param`, `data-rz-telemetry-banner-slot` and `p.rz-prov` stays in the DOM,
    reachable in ≤ 1 tap.
  - The coverage, provenance (L1–L5), point-coverage ratchet and shell gates must stay green **unchanged**. No gate
    is re-recorded to make this pass.
- **R5. Subtitle → tooltip of the title.** No truncation at any width.
- **R6. The hub (dc-conventional) and the DC AI dashboard keep their KPI role.** Only repeated values fold into
  Details.

## A3. Ownership — decided by the owner 2026-11-21: **I build Q1**

| piece | files | builder |
|---|---|---|
| state chip + Details slot in the cockpit bar | `js/conv/shell.js`, `css/conv-shell.css` | me (Q1a) |
| chiller (first), fire, ict, EPMS, water, fuel, hub | their `.html` | me (Q1b) |
| datahall | `datahall.html` | the Conventional session's DATAHALL-SPACE release; I add the page to the gate after it lands |
| DC AI, cdu-mini-bms, gate, standards | done (Q0, Q2) | me |

**Coordination with the Conventional session:**
- I start Q1 on top of their v3.83.0 once it is on main, so their release is not rebased under them.
- Before I start, I message them which files I take: shell + 7 pages.
- From then until my push, they do not edit those files. If they must, they tell me.
- Their gates (`run-conv-release-gates.sh`) are mine to pass before push.

## A4. Laws (gate `tools/test-cockpit-quiet.mjs`, rendered, authorized audit state, both themes)

| law | claim | red today |
|---|---|---|
| Q-L1 | drawTop ≤ 220 px (1440 × 900) and ≤ 300 px (390 × 844) on the 6 mimic cockpits, DC AI and cdu | chiller 453 / 766 … fuel 616 / 1508 |
| Q-L2 | ≤ 25 words above the drawing in its column (excluding the bar and tabs) | 111–186 |
| Q-L3 | 0 numbers above the drawing that are also drawn on it | chiller 19.4, water, EPMS |
| Q-L4 | 0 visible matches of `\.js\b · engine\. · conv-engine · "= seconds" · "= the model" · "= your browser" · "since render"` | 8 pages |
| Q-L5 | 0 framed boxes ≥ 40 px tall with < 8 % content area | chiller `header.bar` 1420 × 58, water / fire / EPMS / ict toolbars |
| Q-L6 | every id / `data-point` / `data-basis-param` / `p.rz-prov` of today's DOM still present (baseline JSON from origin/main), and the existing gates green | guard |
| Q-L7 | Details is a `<summary>` or `aria-expanded` button, keyboard Enter / Space, ≥ 44 px tall on a phone; the open state survives a reload | new |
| Q-L8 | the state chip's text equals the alarm state; its tooltip shows the provenance line; axe 0 serious | new |
| Q-L9 | owner sign-off by eye: before and after at 1440 and 390, dark and light, 10 cockpits | screenshots sent |

The gate already holds Q-L1–Q-L5 and Q-L7 (v1). Q-L6 and Q-L8 are added in Q1.

## A5. Phases

| phase | content | who | proof |
|---|---|---|---|
| Q0 ✅ | gate (laws L1–L5, L7) | me | red on 7 Conventional pages + DC AI + cdu (quoted above) |
| Q2 ✅ | DC AI KPI strip → Details; cdu hero → About, SIM in the hero row, tile guide → Details, NORMAL sentence → tooltip | me | gate 24/24 green; 8 existing gates green; screenshots 390 / 1440, light, keyboard open |
| Q1a | shell: state chip + Details slot (API `RZConvShell.details(el)`), tooltip panel for provenance; gate fixes (L0 bars, select options) | me | `test-conv-shell` + Q-L8 |
| Q1b | chiller (the owner's screenshot first), then fire, ict, EPMS, water, fuel, hub | me | gate `--only` grows per page; Q-L6 baseline |
| Q3 | datahall joins the gate after DATAHALL-SPACE is on main | either | gate |
| Q4 | standards: `HMI_DRAWING_STANDARD` §4e (done), `SITE_CHROME_STANDARD` §9 state chip + Details, `ANTI_VIBECODE` row "chrome text budget" | me | doc diff in the same release |

**Release order** (version numbers decided at push time; first push keeps the next number):
1. My DC AI v3.83.0 (full gate running, step 65+ / ~256, 0 failures so far).
2. The peer's DATAHALL-SPACE.
3. My Q0 + Q2 release.
4. Q1 releases.

## A6. Risks

| risk | mitigation |
|---|---|
| gates that read a moved element's visibility (point-coverage ratchet counts visible numbers) | the point-coverage gate stays green on Q2 with the strip folded; Q1 reruns it per page; if a visible-count ratchet falls, that is allowed (it only fails on a rise) |
| provenance L2 / L3 read `p.rz-prov` by id and text | text and id unchanged; only its container moves |
| version collisions with the peer (happened 3× today) | fetch before each push; port to the next number; never merge release files, regenerate them |
| a folded value the operator needs at a glance | only values that are on the drawing or the inspector fold; alarm state stays in the chip at L0 |

---

# Part B — total audit of the owner's open comments (R183)

**Method.** Every ledger row not marked closed (41 rows, merged by id) was checked read-only against:
- origin/main `9b6f01410` (v3.82.0): commit and path evidence;
- unpushed local branches.

The audit was done by a subagent; I re-checked the cockpit rows myself. "On main" means committed to origin/main.
It does not prove the live site serves it: the live check runs with each release.

| id | owner words (short) | real state | what remains | plan |
|---|---|---|---|---|
| R161 | "tooltip dan modal masih kurang, modal … ada sld/schematic" | PARTIAL: own schematics on main (v3.65.0/.2, `08e523bdd`); `test-dh-drawings` H3 reported only, 27 of 45 classes | one modal shell + one tooltip (A2a); schematics for fire point, VESDA, MCP, EPO; H3 strict | LIVING-PLANT A2a, after the B releases |
| R162 | "di bawah rack … banyak angka … nggak jelas; animasi air mengalir, udara meniup, angin panas HAC" | PARTIAL, **not on main**: hall chips, named sensors, water flow + state colour are in my v3.83.0 | push v3.83.0; air-blow and HAC hot-air (A3) not started | v3.83.0 push, then A3 |
| R163 | "angka di klik … modal trendline … add data line … compare" | PARTIAL: Conventional done (`rz-trend.js` 3.0.0, v3.82.0); DC AI has none | DC AI adopts the shared trend (B4); trend design per PRD_TREND_CHART_DESIGN (R181) | B4 after B2 |
| R164 | "network … modal firewall … block-block" | PARTIAL: Conventional `d81316acf` v3.72.0; DC AI conduit firewalls `8e47fbe5e` v3.78.0 | DC AI per-device internal drawings (A2b) | A2b |
| R165 | "EPMS … klik equipment keluar TCC curve … compare" | Conventional DONE (`bef6cdfc7` v3.74.0); DC AI none | DC AI 150 kV GIS + TCC (A6 / A7) | A6 / A7 |
| R172 | "kok nggak ada perubahan … yakin sudah push?" | DONE with a gap: account / privacy / terms have no site bar | three pages without the bar (peer-owned since R175) | tell the peer (Part C) |
| R174 | "animasi2nya sangat kurang" → "Setujui, mulai dari A0" | A0 on main; **A1 only in my v3.83.0** | A1 push; A2a–A7c | push, then in order |
| R178 | "angka normal hijau … kuning … merah … trendline 1d 7d" | Conventional DONE (v3.82.0); DC AI B1 unpushed (in v3.83.0); B2 colours not built | push B1; B2 colours (needs the peer's `point-status.js`, now on main) | B2 next |
| R179 | "uiux datahall … refine dan polish more" | B5a + B5b **only in v3.83.0** | push; D5 path cards, D7 airflow, D8 section, D10 phone pan | push, then B5c |
| R180 | "Angka2 itu harus dimasukkan database" | Conventional migration + runbook on main; **the owner must run the migration** | owner runs `supabase/migrations/2026-11-20-conv-points.sql` (`! npx supabase login` first); DC AI historian B3 | owner action + B3 |
| R181 | "Warna chart sangat ai design slop" | Conventional trend rebuilt (v3.82.0, PRD-CONV-TREND-DESIGN); my PRD in WIP `8688b175a` | DC AI adoption (B4) + C-gate; check the rebuilt trend against my G1–G14 | B4 |
| R182 | this PRD | Q0 + Q2 local | Part A | Part A |
| R139/R140 | "finish all", "detail deep shader" | mostly shipped (sheets on main); hall plan still legacy `hSvg` | hall plan as an HMI sheet; L3 per class | LIVING-PLANT later phase |
| R110 | PRDs by agents | DONE: `002a509dc` (path in the ledger was wrong) | fix the ledger path | ledger |
| R114 | tools (Postiz …) | PARTIAL: Postiz stack **missing** in `~/homelab/dockge/stacks/` although the ledger says ready | owner decision (R115 postponed it) | ask in the report, no build |
| R097 | live audit findings 1–5 (peer v3.34.1) | UNKNOWN: no v3.34.1 on main | find which release carried them; live check | audit item |
| R043, R057 | local smart model / Opus-level local agent | outside the repo; a stated limit (memory: local LLM not viable) | close as answered with the reason | ledger |
| R091 R094 R101–R105 R112 R116 R125 R126 R138 R143 R146 R166–R171 R173 R175–R177 | — | DONE-ON-MAIN (sha in the audit table) | none | mark CLOSED in the ledger with the sha |

**Not done but owed by the owner:**
- R180: run the Supabase migration.
- R114: decide on Postiz.

**Ledger fixes (R183):**
- each DONE row gets its sha;
- the R110 path is corrected;
- the R097 / R043 / R057 / R114 rows get the verdict above.

---

# Part C — making the other sessions aware

- **Done 2026-11-21.** A message went to the three interactive local sessions (`baguspermana7-02`, `-8a`, `-fc`).
  The Conventional session cannot be identified by name, so it went to all three. Its content: the owner's words,
  the PRD path, the gate path, the red numbers, ownership, and the v3.83.0 version clash. No reply yet.
- **On approval:**
  - a second message with the approved PRD (committed path), the Part B table rows that are theirs (R172 account
    pages, Q1), and the release order;
  - the PRD is committed to main with my next release, so a session that misses the message still finds it under
    `documentation/prd/`;
  - an R182 / R183 row in the shared `OWNER_REQUESTS_STATUS.md` (it already has R182).

---

## Verification (end to end)

1. **Red.**
   - `node tools/test-cockpit-quiet.mjs` on origin/main: quote the per-page fails (done for v1).
   - The Q-L6 baseline JSON is generated from origin/main.
2. **Green per release.**
   - The same gate with `--only=<released pages>`.
   - The existing gates for those pages (coverage, provenance, point coverage, shell, operator regressions,
     telemetry docs, a11y, dark coverage).
   - Then the full `tools/ship-gate.sh`.
3. **Live.** After each push, on resistancezero.com:
   - the released cockpits at 1440 and 390, dark and light, at rest and with Details open;
   - I look at every screenshot and send before/after pairs to the owner.
4. **Ledger.** OWNER_REQUESTS_STATUS rows updated with the sha, and the owner gets one report listing each law with
   its evidence.

## Decisions

- **Q1 builder:** me (owner, 2026-11-21, AskUserQuestion).
