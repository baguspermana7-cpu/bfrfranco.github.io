# Article 30 — Diagram Specifications (RZDiagram engine)

Every figure is drawn through `js/rz-diagram.js` (`create → zone → node → text → edge → fit → render`). No coordinates; the
engine sizes and routes. Rules from `standarization/DIAGRAM_ENGINE_STANDARD.md`:
- Colours are roles only (`ink`, `muted`, `accent`, `link`, `alarm-normal`, `alarm-caution`, `alarm-fault`, `paper-2`).
  Convention for this article: **probabilistic** components use `accent`; **deterministic** components use `ink`;
  **human** gates use `alarm-caution`; **safety-rated** equipment uses `alarm-fault` outline.
- IEC `symbol` only on nodes that are equipment (chiller, CRAH, PLC, breaker). Concepts get none.
- Every number on a figure carries its source tag, repeated in the caption. Fill `title` and `desc` on every figure.

Notation: `node(id, "Name", "sublabel")`; `edge(a → b, "label")`; `zone("Caption", [members])`.

---

## D1 — What the video says vs what happens
- **title:** "One tool call, two descriptions". **desc:** "Top: the video's account. Bottom: the same call with the decisions the model makes marked."
- **Zone A "As described in the video [S1]":** `u1("User", "'book me a table'")` → `l1("LLM", "guesses a command")` → `py("python opentable.py")` → `api("OpenTable API")` → `l1b("LLM", "'I booked you a table!'")`.
- **Zone B "As documented [S15][S16][S58]":** `u2("User intent", "free text")` → `l2("LLM: plan", "parse goal, pick tool, fill args")` → `h("Harness", "schema check · permissions")` → `x("Executor", "API call or browser action")` → `w("World", "site / API")` → `o("Observation", "result or error")` → back to `l2` ("next step or stop"); `l2 → g("Confirm gate", "before side effects")` → `x`.
- **Edges labelled** with who decides: "decided by model" (accent) vs "executed by code" (ink).
- **Caption:** "Operator drove a browser from screenshots, not an API script [S58]. The mechanism in the video is right; 'the LLM did nothing' is not."

## D2 — The agent loop with verifiers
- **title:** "Observe, act, verify". **desc:** "The model proposes; deterministic checks decide whether the step counts."
- **Nodes:** `ctx("Context", "goal · history · tool results")`, `llm("LLM", "propose next action")`, `val("Schema / policy check")`, `exe("Execute tool")`, `ver("Verifier", "tests · lint · types · rule check")`, `bud("Budget guard", "steps · tokens · time · $")`, `hum("Human gate", "irreversible actions")`, `done("Stop: success or escalate")`.
- **Edges:** ctx→llm, llm→val, val→exe ("valid"), val→llm ("reject: reason"), exe→ver, ver→ctx ("pass/fail + log"), bud→llm ("halt"), llm→hum ("side effect"), hum→exe ("approved"), ver→done ("goal met").
- **Key number:** "Anthropic: ground truth from the environment at each step [S14]".

## D3 — Workflow vs agent spectrum
- **title:** "Who decides the next step?". **desc:** "Six levels, from hand-written logic to an autonomous agent."
- **Nodes left→right:** `c0("Code", "rules decide everything")`, `c1("Single LLM call")`, `c2("Chain", "fixed sequence")`, `c3("Router", "LLM picks a branch")`, `c4("State machine", "LLM picks transitions")`, `c5("Agent", "LLM picks steps and tools")`.
- **Under each:** three small rows "output / next step / available steps" coloured ink (code decides) or accent (LLM decides) per [S20].
- **Zone brackets:** "Workflow (predefined code paths)" over c1–c4 [S14]; "Agent" over c5. Separate tag above c0–c2: "cron, RPA, expert systems: decades old" (§3.3).

## D4 — The software factory pipeline and its gates
- **title:** "Factory: LLMs write, exit codes decide". **desc:** "Spec to merge with every transition recorded by the factory CLI in board.json."
- **Nodes:** `req("Feature request")`, `spec("spec-writer", "spec.md")`, `bld("builder", "code + tests, commit")`, `gate("factory gate", "lint · test · build · secrets · protected · tests_added · nonempty")`, `rv1("reviewer-security")`, `rv2("reviewer-code")`, `rv3("reviewer-ux", "SKIP if no UI file")`, `rv4("reviewer-ui", "SKIP if no UI file")`, `ver("factory verdict", "VERDICT regex · HEAD unchanged")`, `dec("DECIDE", "fix ≤2 · override · abandon")`, `app("approver", "factory deliver")`, `mg("Merge result re-gated", "lint · test · build")`, `main("main", "push only if push=true")`, `board("board.json")`.
- **Edges:** req→spec→bld→gate; gate→bld ("NEEDS_FIX, ≤3 rounds"); gate→rv1..rv4 ("REVIEW", parallel); rv*→ver; ver→bld ("NEEDS_FIX"); ver→dec ("rounds exhausted"); dec→bld ("fix"); ver→app ("READY"); app→mg→main; dashed edges from gate, ver, dec, app → board ("state").
- **Styling:** LLM roles accent; CLI steps ink; hard gates drawn with a solid bar and tag "never overridable" [S60].
- **Caption:** "Hard gates: lint, test, build, nonempty, secrets [S60]. One demo job passed all gates, security and code PASS, UX/UI SKIP [S61]."

## D5 — The probabilistic / deterministic split
- **title:** "Drafter and checker". **desc:** "What each half is good at, and the interface between them."
- **Two zones side by side:** Zone "Probabilistic (LLM)": nodes `p1("Read free text, logs, screenshots")`, `p2("Choose among options")`, `p3("Draft code, MOP, ticket")`, `p4("Explain")` with a footnote "its self-explanations can be unfaithful [S3]". Zone "Deterministic (code)": `d1("Parse and validate schema")`, `d2("Execute and measure")`, `d3("Test, lint, type-check")`, `d4("Enforce limits and permissions")`, `d5("Log and replay")`.
- **Middle node:** `iface("Typed tool interface", "JSON schema · allow-list · ranges")` with edges p*→iface→d* and d3→p3 ("error text back").
- **Caption:** "The seam is where the engineering lives."

## D6 — Compounding error chain
- **title:** "0.95 twenty times". **desc:** "Per-step success multiplies; a verifier with retries breaks the chain."
- **Row 1 (no verifier):** 20 small step nodes `s1…s20` each "p = 0.95" chained → `r1("Run succeeds", "0.95²⁰ = 0.358")`.
- **Row 2 (verifier d = 0.9, k = 2):** same chain, each step with a loop-back edge "detected → retry" → `r2("Run succeeds", "0.995²⁰ ≈ 0.899")`.
- **valueKey:** bind `p`, `n`, `d`, `k` to calculator C-ii so the figure updates live.
- **Caption:** "Derived in CALCULATORS C-ii; METR's 50% vs 80% horizon gap is the field version [S27]."

## D7 — Economics and hype timeline
- **title:** "Money, models and narratives, 2024–2026". **desc:** "Events on one time axis: capability, capital, critiques."
- **Lane "Capability":** `t1("Dec 2024", "Sutskever: pre-training will end [S53]")`, `t2("Mar 2025", "circuit tracing paper [S3]")`, `t3("Jun 2025", "Illusion of Thinking + rebuttal [S5][S6]")`, `t4("Jan 2026", "METR TH1.1, ~131-day doubling [S26]")`, `t5("Apr 2026", "50% horizon ≈17 h, 80% ≈3 h [S27]")`.
- **Lane "Capital":** `m1("Feb 2026", "OpenAI $110B → $122B at $852B [S51]")`, `m2("May 2026", "Anthropic $65B at $965B [S48]")`, `m3("Jun 2026", "Anthropic draft S-1 [S49]")`, `m4("Jul 2026", "big-four 2026 capex ≈$0.7T [S40]–[S45]")`, `m5("Sep 2026", "OpenAI IPO not in 2026 [S52]")`.
- **Lane "Critique":** `k1("Jun 2025", "Gartner: >40% of agentic projects cancelled by 2027 [S39]")`, `k2("Aug 2025", "MIT NANDA '95%' [S37]")`, `k3("Nov 2025", "LeCun leaves Meta [S55]")`, `k4("Feb 2026", "SWE-bench Verified retired by OpenAI [S23]")`, `k5("Aug 2026", "Elder video [S1]")`, `k6("Sep 2026", "safety departures [S56]")`.
- **No edges** except a faint time axis; zone per lane.

## D8 — OT safety interlock pattern
- **title:** "An agent next to a chiller plant". **desc:** "The agent can read and propose; only the control system, with its interlocks and a human, can act."
- **Zones:** `zone("IT / enterprise", [agent, kb, tkt])`, `zone("DMZ", [hist, gw])`, `zone("OT control (IEC 62443 zone)", [bms, plc])`, `zone("Safety (IEC 61511 / SIS)", [sis])`.
- **Nodes:** `agent("LLM agent", "read-only tools")`, `kb("SOP / MOP library")`, `tkt("CMMS / ticket")`, `hist("Historian replica", "one-way out")`, `gw("Change gateway", "range check · interlock check")`, `op("Operator", "approves")` (alarm-caution), `bms("BMS / EPMS", "supervisory")`, `plc("PLC", symbol: plc)`, `chl("Chiller", symbol: chiller)`, `sis("SIS / EPO / fire", "hard-wired, out of scope")` (alarm-fault).
- **Edges:** plc→bms→hist→agent ("trends, alarms — one way"); kb→agent; agent→tkt ("draft work order"); agent→op ("proposed change + evidence"); op→gw ("approved"); gw→bms ("setpoint within limits"); bms→plc→chl; sis→chl ("trip", independent). No edge from agent to bms, plc or sis.
- **Caption:** "'Limit active control of OT infrastructure by AI without a human in the loop' — CISA, ASD ACSC et al. [S33]."
