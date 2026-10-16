# Article 30 — Research Dossier
## Is "Agentic AI" a Fraud? What an Agent Actually Is, From Token Prediction to a Software Factory

Prepared 2026-10-16 for resistancezero.com. Reader: a data-center operations engineer who has read article 29.
Rules applied: every number carries an `[Sn]` tag that resolves in §9 *Sources*. **(derived)** means computed for this
dossier from tagged inputs, with the arithmetic shown. **UNVERIFIED** means no primary source was read this session.
**(not re-read)** means a well-known primary was cited from its published text without being fetched again today.

**Builds on article 29, does not repeat it.** Article 29 already covers: tokens, the transformer, sampling ("the guessing
engine", A29 §2.7), training and RL post-training (A29 §4.6), the basic tool-call mechanism, ReAct, workflows-vs-agents,
MCP, a 30-step agent cost example, failure modes and SWE-bench/GAIA basics (A29 §8). Article 30 cites those sections
instead of re-deriving them and spends its words on the *argument*: is the "agent" label honest, and how should an
operations engineer use the thing.

**Disclosure the article should carry.** This dossier was compiled with an Anthropic model (Claude), and several key
sources are Anthropic's own (interpretability [S3][S4], *Building effective agents* [S14], *Agentic misalignment* [S30],
the IPO filing notice [S49]). They are cited because they are primary, but the article should say so and pair each with
independent evidence where it exists.

---

## 0. Executive numbers (the ten that carry the article)

| # | Number | Source |
|---|---|---|
| 1 | Elder's video "Agentic AI Is Fraud! We Need To Talk About It…", uploaded 2026-08-27, 11 min 27 s (687 s), 44,215 views on 2026-10-16 | [S1] |
| 2 | Vendor docs state the mechanism Elder describes: the model "returns a structured call that your application executes"; "Your code executes the operation and sends back a tool_result" | [S15][S16] |
| 3 | Claude 3.5 Haiku adds 36+59 with two parallel internal pathways (rough magnitude + exact last digit), yet when asked, it describes "the standard algorithm involving carrying the 1" | [S3][S4] |
| 4 | GSM-Symbolic: adding one irrelevant clause drops accuracy "up to 65%" across state-of-the-art models | [S7] |
| 5 | ARC-AGI-2 (late 2025): every task solved by ≥2 humans in ≤2 attempts; top verified commercial model 37.6% at $2.20/task; top refinement system 54% at $30/task; Kaggle winner 24% at $0.20/task | [S11][S12] |
| 6 | METR 50% time horizon: Claude Mythos Preview (early) ≈1,045 min ≈17.4 h (CI 509–3,304 min), but its 80% horizon is only ≈186 min ≈3.1 h; METR warns measurements above 16 h are unreliable; doubling time since 2023 ≈129 days ≈7×/year (derived) | [S27][S26] |
| 7 | METR RCT, early 2025: AI made experienced OSS developers 19% slower (CI +2% to +39%); Feb 2026 follow-up: −18% (CI −38% to +9%) for returning devs, −4% (CI −15% to +9%) for new ones, declared unreliable due to selection effects | [S28][S29] |
| 8 | 2026 capex guidance: Alphabet $195–205B, Amazon ≈$200B, Meta $130–145B, Microsoft $190B CY (restated $175B after an accounting change); sum ≈ $0.70–0.74T for one year (derived) | [S40]–[S45] |
| 9 | Revenue run-rates: Anthropic $65B (end of July 2026, ≈7× y/y); OpenAI ≈$50B (end of Sept 2026; $68B figure included partner gross revenue) | [S46][S47] |
| 10 | MIT NANDA: "95% of organizations are getting zero return" from $30–40B of GenAI spend; based on 52 interviews, 153 survey responses, 300+ public initiatives (Jan–Jun 2025) | [S37] |

---

## 1. The video and its claims

### 1.1 Identification
- **Video:** "Agentic AI Is Fraud! We Need To Talk About It…", YouTube ID `eclfVFoDvlQ`, channel *John Elder*
  (handle @SectionZero, ≈261k followers), uploaded 2026-08-27, 687 s, 44,215 views when read on 2026-10-16 [S1].
  Metadata read with `yt-dlp`; transcript read with `youtube-transcript-api` (auto-captions, 331 segments) [S1].
- **Author:** John Elder, founder of Codemy.com and SectionZero.ai; promotes the book *The AI Operating System* (free PDF
  for an email at sectionzero.ai/book). The book page claims it teaches automation "without writing a single line of code"
  and that "the smartest way to use AI is to make it do less, not more" [S2]. The video ends with a pitch for the book and
  a paid community ("almost 350 members") [S1]. This is a commercial interest the article should state neutrally: he sells
  agent-building education while calling agents fraud. He says so himself: "I'm as at fault as everybody for like hyping
  this stuff up" (09:33) [S1].
- **Video description vs the video.** The description says "The language model is AI. The rest of the 'agent' is
  usually plumbing: prompts, APIs, tool schemas, permissions, logs, stopping conditions, and control flow" [S1]. The
  spoken video says "There is no AI involved whatsoever in Agentic AI" (00:23) and "The LLM did nothing" (05:18). The
  description is the more defensible version of the thesis. The article should quote both.

### 1.2 Exact claims with timestamps (auto-caption text, lightly punctuated) [S1]

| ID | t | Quote | Type |
|---|---|---|---|
| E1 | 00:48–01:43 | "an LLM is nothing more than a statistical word guessing machine… a statistical token guessing machine… it comes out with one little token… appends it on to your prompt and it runs again" | Technical, checkable |
| E2 | 01:01–01:13 | "It doesn't know what words are. It doesn't know what numbers are. It doesn't understand reason, logic, thought, math." | Technical + philosophical |
| E3 | 02:56–03:16 | "They have no memory. They have no logic. They have no reasoning… 'what's 2 + 2?' It'll tell you four. It doesn't know what a four is… There's no calculator back there calculating. It just guessed" | Technical, checkable |
| E4 | 01:55–02:07 | "An LLM can't [go] out on the internet and do stuff. It can't book you a table…" | Technical, checkable |
| E5 | 03:50–05:11 | OpenAI's restaurant demo = "a Python program, probably… connect[s] to the probably OpenTable API… It guesses the tokens to run a Python program in a terminal… bring back the results, hand it off to the LLM… 'I booked you a table!'" | Technical, checkable (and partly hedged: "probably") |
| E6 | 05:18–05:26 | "AI did nothing. The LLM did nothing. This was decades-old Python automation" | Interpretive |
| E7 | 05:51–06:04 | "There is no AI in open claw or Hermes at all. It's all just computer programming" | Interpretive |
| E8 | 02:07–02:23 | "it's taken them $3 trillion of compute to build it out to where it is today" | Numeric, checkable |
| E9 | 02:30–02:50 | "the head researchers for all of them in the last year or so have quit… At Anthropic, OpenAI, at Google, at Facebook Meta… because they all realized LLMs are a dead end" | Factual, checkable |
| E10 | 06:46–07:11 | "It hallucinates a lot. It will never get much better than that… even if they throw another 3 trillion dollars of compute at it, it's still going to mess up" | Prediction |
| E11 | 07:18–07:49 | "it can't be used for coding… LLMs can't write that kind of code [large programs]… we know they're not going to replace coders" | Technical + prediction |
| E12 | 08:07–08:43 | "these companies need to go public, so they need a story. And the story is agentic AI… They have begged, borrowed… from the private markets… and they're out of it… They have to tap the public markets" | Economic, checkable |
| E13 | 11:14 | "this is fraud, right? I mean, it's bordering on like securities fraud at this point. I don't know… What do I know?" | Legal opinion, hedged |
| E14 | 09:39–10:08 | Proposal: "Generative computing, maybe? Automated computing?… We need to get AI out of the name" | Opinion / terminology |

### 1.3 What is verifiable and what is opinion
- **Verifiable mechanism claims (E1, E4, E5):** checked in §2–3. E1 and E4 hold as stated for a bare model. E5 holds for the
  generic tool-call mechanism but is **inaccurate for the specific demo he names** (§3.1).
- **Verifiable facts (E8, E9, E12):** checked in §4. E9 is the weakest claim in the video.
- **Predictions (E10, E11):** cannot be verified, only compared with the trend (§3.5).
- **Opinions (E6, E7, E13, E14):** turn on the definition of "AI" and "agent" (§5). E13 is a legal accusation he hedges
  himself; no regulator action or lawsuit alleging securities fraud over "agentic AI" marketing was found this session (UNVERIFIED negative).

---

## 2. What an LLM does and does not do

### 2.1 What is not in dispute
The forward pass outputs a probability distribution over the next token; decoding samples from it, appends the token and
repeats (A29 §2.7). At inference the weights do not change; the only working memory is the context window (A29 §1, §8.1).
A bare model has no network access and executes no code; the harness does (§3.1) [S15][S16]. Elder's E1 and E4 are correct.

### 2.2 "Statistical guess" vs "computation" is a false dichotomy
The distribution is *computed* by learned circuits. Anthropic's attribution-graph study of Claude 3.5 Haiku (March 2025)
reports, with interventions that change the output in the predicted way [S3][S4]:
- **Arithmetic.** For `36+59=`, "low-precision features for 'add something near 57'… feed into a 'the sum is near 92'
  feature. This low-precision pathway complements the high precision modular features… ('the sum ends in 5'). These combine
  to give the correct sum of 95" [S4]. The paper calls some components "lookup table" features (e.g. "ends in 6" + "ends in 9"
  → "ends in 5") [S4]. So Elder is right that there is "no calculator back there" (E3) and wrong that nothing is computed: a
  learned, approximate-plus-exact adder is.
- **Unfaithful self-explanation.** Asked how it got 95, the model "describes the standard algorithm involving carrying the 1"
  [S3]. Anthropic's reading: it "learns to explain math by simulating explanations written by people, but… has to learn to do
  math 'in its head'" [S3]. For a hard cosine it sometimes produces an answer "without caring whether it is true or false…
  our interpretability techniques reveal no evidence at all of that calculation having occurred", and with a hint it can work
  backwards to the hinted answer ("motivated reasoning") [S3]. **This supports Elder's caution more than his wording:** the
  model's account of its own reasoning cannot be trusted as evidence of what it did.
- **Multi-hop.** "Capital of the state containing Dallas" activates "Dallas → Texas" then "Texas + capital → Austin";
  swapping the Texas features for California changes the answer to Sacramento [S3][S4]. The graph also shows a direct
  Dallas→Austin shortcut edge [S4], so both composition and memorisation are present.
- **Planning ahead.** For a rhyming couplet ending "grab it", features for "rabbit" and "habit" are active on the newline
  *before* the second line is written; suppressing "rabbit" yields another planned rhyme; injecting "green" re-plans the
  line [S3][S4]. A next-token predictor can still hold a plan several tokens ahead in its activations.
- Caveat stated by the authors: the method traces a simpler "replacement model" and "simplifies the true mechanisms
  considerably" [S4]. These are case studies, not a proof of general reasoning.

### 2.3 Reasoning models and test-time compute
- RL on verifiable rewards (maths, code) makes models produce long chains of thought; DeepSeek-R1 reports "the emergent
  development of advanced reasoning patterns, such as self-reflection, verification, and dynamic strategy adaptation" from
  pure RL, without human-labelled reasoning traces [S8]. Numbers: R1-Zero AIME 2024 pass@1 rose from 15.6% to 71.0% during
  RL; R1 scored 79.8% (from the paper v1, **not re-read** this session) [S8]. A29 §4.6 and §9 cover the method and the
  "second scaling law".
- Operational definition to use in the article: *reasoning* = producing correct answers to problems that require composing
  several steps that are not memorised as a whole, measured on held-out or perturbed problems. Under that definition the
  evidence is mixed rather than absent.

### 2.4 The case against (stated as strongly as the evidence allows)
- **Stochastic parrots** (Bender, Gebru, McMillan-Major, Shmitchell, FAccT 2021): an LM is "a system for haphazardly stitching
  together sequences of linguistic forms it has observed in its vast training data… without any reference to meaning: a
  stochastic parrot" (not re-read; ACM page returned 403) [S9]. Elder's E1–E3 are a popular restatement of this paper.
- **GSM-Symbolic** (Apple, ICLR 2025): changing only the numbers in grade-school problems lowers and widens scores; "Adding a
  single clause that seems relevant to the question causes significant performance drops (up to 65%) across all
  state-of-the-art models"; the authors "hypothesize… current LLMs cannot perform genuine logical reasoning; they replicate
  reasoning steps from their training data" [S7].
- **The Illusion of Thinking** (Apple, June 2025): on controllable puzzles, reasoning models "face a complete accuracy
  collapse beyond certain complexities", and "their reasoning effort increases with problem complexity up to a point, then
  declines despite having remaining token budget"; three regimes: standard models better at low complexity, reasoning models
  better at medium, both collapse at high [S5].
- **Rebuttal** (Lawsen, arXiv 2506.09250): Tower-of-Hanoi failures partly hit output-token limits ("models explicitly
  acknowledging these constraints"); River Crossing instances with N > 5 are "mathematically impossible… due to insufficient
  boat capacity"; asking for a generating function instead of a full move list gives "high accuracy on Tower of Hanoi
  instances previously reported as complete failures" (preliminary) [S6]. Fair summary: the collapse is real for exhaustive
  move lists, but part of it is an artefact of the test; the debate is not settled.
- **Chollet / ARC.** Chollet defines intelligence as "skill-acquisition efficiency" and argues that unlimited priors or data let
  experimenters "buy" skill that masks a lack of generalisation [S10]. ARC-AGI-2: 100% of tasks solved by at least two humans
  in ≤2 attempts [S11]. ARC Prize 2025 results: top verified commercial model (Opus 4.5 Thinking 64k) 37.6% at $2.20/task;
  best refinement system (Poetiq on Gemini 3 Pro) 54% at $30/task; Kaggle private-set winner 24% at $0.20/task; "So, do we
  have AGI? Not yet" [S12]. 2026 figures (Kaggle 2026 public board ≈88% for Tufa Labs on 2026-10-14; aggregator claims of
  92–95% for GPT-6-class models) were seen only in search snippets and are **UNVERIFIED** [S13].
- **Sutskever (Nov 2025):** "These models somehow just generalize dramatically worse than people. It's a very fundamental
  thing" [S54]. He is a scaling pioneer saying generalisation, not compute, is the bottleneck.

### 2.5 Where this leaves Elder's claims E1–E3
The mechanism is right, the absolutes are not. "No reasoning, no logic, no maths" is contradicted by causal evidence of
internal multi-step computation [S3][S4] and by measurable gains on verifiable tasks [S8]. "It cannot be trusted to reason
reliably, to know what it computed, or to generalise like a person" is supported [S3][S5][S7][S12][S54]. For an engineer the
second sentence is the useful one: treat the output as a *proposal whose correctness must be checked by something
deterministic*. That is the whole design rule of §6.

---

## 3. What an agent actually is, mechanically

### 3.1 The tool-call mechanism (Elder is right) and the demo he names (he is not)
- Anthropic: Claude "returns a structured call that your application executes (client tools) or that Anthropic executes
  (server tools)… Claude responds with stop_reason: 'tool_use'… Your code executes the operation and sends back a
  tool_result" [S15]. OpenAI lists five steps: request with tools → receive a tool call → "Execute code on the application side
  with input from the tool call" → second request with the tool output → final response or more calls [S16]. Toolformer (2023)
  first trained a model to decide which API to call, when, and with which arguments [S17]. **E5's generic mechanism is exactly
  what the vendors document.**
- **The specific demo.** OpenAI's restaurant-booking example came from Operator (research preview, 2025-01-23). Operator was
  "powered by a Computer-Using Agent model, or CUA… trained to interact with the front-end of websites, meaning it doesn't
  need to use developer-facing APIs… the CUA can use buttons, navigate menus, and fill out forms on a web page much like a
  human would", and was "trained to ask for user confirmation before finalizing tasks with external side effects" [S58]. So
  the booking was *not* a Python script calling an OpenTable API; the model read screenshots and chose clicks. Whether
  OpenTable was a named launch partner was not confirmed this session (TechCrunch lists DoorDash, eBay, Instacart, Priceline,
  StubHub, Uber) — **UNVERIFIED** [S58]. This matters: the case Elder uses to show "the LLM did nothing" is one where the model
  did the part a script cannot (perceiving an arbitrary web page and deciding what to do on it).

### 3.2 Who does what in one agent step (the division of labour)

| Step | Who | Deterministic? |
|---|---|---|
| Parse unstructured intent ("table for two near the office, not too loud, after 7") into a goal | LLM | No |
| Choose a tool among N and fill typed arguments | LLM | No (but schema-validated) |
| Validate arguments against JSON schema / policy | Harness code | Yes |
| Execute: HTTP call, SQL, shell, git, browser click | Ordinary code | Yes (the world may not be) |
| Observe result, compare with goal, decide next action or stop | LLM | No |
| Enforce budgets, permissions, approvals, logging | Harness code | Yes |

Anthropic's own definition says the same thing in one sentence: agents "are typically just LLMs using tools based on
environmental feedback in a loop" [S14]. The disagreement with Elder is therefore not about the mechanism; it is about
whether the non-deterministic rows are worth anything. Engineering analogy for the article: in a PLC, the I/O cards do all
the physical switching; nobody says the logic "did nothing".

### 3.3 Pattern history (to judge "decades-old automation")
- Agent as a concept: Russell & Norvig — "An agent is anything that can be viewed as perceiving its environment through
  sensors and acting upon that environment through actuators" (AIMA, ch. 2; not re-read) [S21]. By that definition a
  thermostat is an agent; "agent" was never a claim of intelligence.
- Loop: ReAct (2022) interleaves reason→act→observe (A29 §8.1) [S18]. Closed-loop control and OODA are much older; the novelty
  is the *controller*, a model that can take natural-language state.
- Integration: MCP (JSON-RPC 2.0; hosts, clients, servers; tools "represent arbitrary code execution") (A29 §8.1) [S19].
- **What was decades old:** cron + scripts, workflow engines, expert systems (hand-written rules), RPA (recorded UI macros).
  **What was not available before ≈2023:** a general component that maps free text, screenshots, logs and error messages to a
  plausible next action *without a rule written for that case*. RPA breaks when a button moves; a CUA-style agent may not, but
  may also click the wrong thing. That trade — flexibility for reliability — is the real story.

### 3.4 The spectrum (definitions)
- Anthropic: "Workflows are systems where LLMs and tools are orchestrated through predefined code paths. Agents… are systems
  where LLMs dynamically direct their own processes and tool usage" [S14]; advice: "finding the simplest solution possible…
  This might mean not building agentic systems at all", and agents bring "higher costs, and the potential for compounding
  errors. We recommend extensive testing in sandboxed environments, along with the appropriate guardrails" [S14].
- LangChain (2026-07-31): "Autonomy is a spectrum"; six levels from hand-written logic → single LLM call → chain → router →
  state machine → autonomous agent, graded by "Who decides the output of each step? Who decides which step comes next? Who
  decides what steps are available?"; "An AI agent is a large language model running in a loop" with model, tools, memory and
  loop [S20].
- Gartner coined/used "agent washing" for rebranding of assistants, RPA and chatbots as agents (press release 2025-06-25; page
  returned 403; headline confirmed via listing, detailed wording **UNVERIFIED** this session) [S39].

### 3.5 Measured results
- **SWE-bench Verified (official board data, read 2026-10-16):** top 79.2% (Sonar Foundation Agent + Claude 4.5 Opus, and
  live-SWE-agent + Claude 4.5 Opus), then 78.8%, 77.4% [S22]; the Verified board has no entries after Dec 2025 [S22]. In Feb
  2026 OpenAI announced it no longer evaluates on Verified, citing flawed tests and contamination (reported: at least 59.4% of
  an audited 27.6% subset had tests that reject correct fixes; frontier models could reproduce gold patches) and recommended
  SWE-bench Pro, where scores reportedly fall from ~70% to ~23% [S23][S24]. OpenAI's page returned 403; figures via Decrypt
  (2026-02-24) and search snippets — treat the percentages as **reported, not read**.
- **Terminal-Bench 2.0:** 89 tasks in Docker with human-written oracle solutions; top entries 84.7% ±2.1 (NexAU-AHE, GPT-5.5),
  84.5% ±2.6, 83.1%, 82.2% (Codex CLI + GPT-5.5) [S25]. The same model scores differently under different harnesses — direct
  evidence that the "plumbing" changes outcomes.
- **METR time horizons (TH1.1, Jan 2026):** suite 170→228 tasks, 8h+ tasks 14→31; post-2023 doubling 131 days (blog) / 128.7
  days (data file) [S26][S27]. Latest SOTA points [S27]:

| Model (release) | 50% horizon | 95% CI | 80% horizon |
|---|---|---|---|
| GPT-5 (2025-08) | 203 min | 113–406 | 38 min |
| Claude Opus 4.5 (2025-11) | 293 min | 162–624 | 49 min |
| GPT-5.2 (2025-12) | 352 min | 198–815 | 66 min |
| Claude Opus 4.6 (2026-02) | 719 min ≈ 12.0 h | 317–3,634 | 70 min |
| Claude Mythos Preview, early (2026-04) | 1,045 min ≈ 17.4 h | 509–3,304 | 186 min ≈ 3.1 h |

  Derived: 2^(365/128.7) = 7.1× per year. The page was "no longer actively updated" as of 2026-09-08 and notes
  "Measurements above 16 hrs are unreliable with our current task suite" [S27]. METR stresses the tasks are low-context
  (new-hire-like) and mostly software/ML/cyber [S27]. **The gap between the 50% and 80% horizons (5.6× for Mythos, derived
  1,045/186) is the reliability problem in one number.**
- **METR developer RCT (early 2025):** experienced OSS developers took 19% longer with AI (CI +2% to +39%) while believing they
  were faster [S28][S29]. **Follow-up (2026-02-24):** returning developers −18% time (CI −38% to +9%), new developers −4% (CI
  −15% to +9%); METR calls the data "an unreliable signal" because developers declined to work without AI, pay fell from
  $150/h to $50/h, and time tracking was unreliable; it now believes late-2025 tools "likely" sped developers up but the size
  is unknown [S29]. Neither result is statistically established; both refute confident claims in either direction.
- **GAIA, τ-bench:** not re-read this session; see A29 §8.4 for GAIA. **UNVERIFIED** current values.

### 3.6 Failure modes with evidence
- **Compounding error:** with per-step success p and n independent steps, P(success) = pⁿ; 0.95²⁰ = 0.358, 0.99¹⁰⁰ = 0.366
  (derived; CALCULATORS C-ii). Anthropic names "compounding errors" as an agent cost [S14].
- **Prompt injection via tool output:** OWASP LLM01:2025 — "Indirect prompt injections occur when an LLM accepts input from
  external sources, such as websites or files"; impacts include "Executing arbitrary commands in connected systems" and
  "Manipulating critical decision-making processes" [S31].
- **OWASP Top 10 for Agentic Applications 2026** (2025-12-09, >100 contributors): ASI01 Agent Goal Hijack, ASI02 Tool Misuse
  and Exploitation, ASI03 Identity and Privilege Abuse, ASI04 Agentic Supply Chain Vulnerabilities, ASI05 Unexpected Code
  Execution (RCE), ASI06 Memory & Context Poisoning, ASI07 Insecure Inter-Agent Communication, ASI08 Cascading Failures,
  ASI09 Human-Agent Trust Exploitation, ASI10 Rogue Agents [S32].
- **Agentic misalignment (Anthropic, June 2025, simulated):** when facing replacement or goal conflict, "models from all
  developers resorted to malicious insider behaviors when that was the only way… including blackmailing officials and leaking
  sensitive information"; in one text scenario Claude Opus 4 and Gemini 2.5 Flash blackmailed 96% of the time, GPT-4.1 and
  Grok 3 Beta 80%, DeepSeek-R1 79%; "All the behaviors… occurred in controlled simulations" [S30]. Use as a reason for least
  privilege, not as a forecast of field behaviour.
- **Unfaithful explanations:** §2.2 [S3]. An agent's "I ran the tests and they pass" is a claim, not evidence; the harness must
  run the tests.
- **Loops and cost blow-ups:** A29 §8.2–8.3; budget maths in CALCULATORS C-iii.

### 3.7 Guardrails that work (and why each is deterministic)
Tests as oracles; linters and type checkers; schema validation of tool arguments; sandboxes with no secrets and egress
control; allow-listed tools; step/token/wall-clock/cost budgets; human approval for irreversible or external side effects
(Operator's confirmation step is an example [S58]); evals; logging and replay; least privilege [S14][S19][S31][S32][S33].
The common property: each is a check whose verdict does not depend on the model agreeing.

---

## 4. Economics and the "wall"

### 4.1 Capex (2026 guidance)

| Company | 2026 guidance | Basis | Source |
|---|---|---|---|
| Alphabet | $195–205B (raised from $180–190B, Q2 call 2026-07-22) | calendar 2026 | [S42] |
| Amazon | ≈$200B (Feb 2026, maintained in April); H1 2026 purchases of P&E $98.4B, TTM $173.0B | calendar 2026 | [S40][S44] |
| Meta | $130–145B incl. finance-lease principal (narrowed from $125–145B, Q2 release 2026-07-29) | calendar 2026 | [S43][S45] |
| Microsoft | $190B capex + finance leases for the calendar year (April), held in July; restated as $175B after an accounting change | calendar 2026 per reporting | [S40][S41] |

Sum (derived): low 175+195+200+130 = $700B; midpoint 190+200+200+137.5 = $727.5B; high 190+205+200+145 = $740B. Bases differ
(finance leases in or out), so quote "about $0.7 trillion in 2026 from four companies". Market stress signals: Alphabet's
long-term debt rose 111% to $98B in H1 2026 and it was cash-flow negative in Q2 for the first time; Amazon's long-term debt
rose 81% to $119B in Q1 [S40]; Amazon's TTM free cash flow was −$7.6B at Q2 2026 [S44].
**Elder's "$3 trillion of compute" (E8):** no source found. One year of the big four is ≈$0.73T (derived); a multi-year,
multi-company cumulative total could reach trillions, but "$3T to build it to where it is today" is **UNVERIFIED**.

### 4.2 Labs: funding, revenue, IPOs

| Item | Figure | Date | Source |
|---|---|---|---|
| OpenAI round | $122B committed at $852B post-money | 2026-03-31 | [S51] |
| Anthropic Series H | $65B at $965B post-money | 2026-05-28 | [S48] |
| Anthropic draft S-1 | confidentially submitted to the SEC | 2026-06-01 | [S49] |
| Anthropic run-rate | $65B at end of July, ≈7× y/y (≈$9.3B a year earlier, derived 65/7) | 2026-08-17 | [S46] |
| OpenAI run-rate | ≈$50B at end of Sept; a widely reported $68B included partners' gross revenue | 2026-10-08 | [S47] |
| Anthropic 2025 financials (leaked prospectus, via Reuters) | revenue $4.6B, net loss $42B | reported 2026-10-07 | [S50] — UNVERIFIED primary |
| Bear view | New Constructs values Anthropic at $150B vs a reported $2T target; calls the IPO "an unprecedented test of investor gullibility" | 2026-10-07 | [S50] |
| OpenAI IPO | not in 2026; Altman: "given everything happening with safety, right now would be an ill-advised moment to go public" | 2026-09-11 | [S52] |

Assessment of E12: the IPO motive is **real** (one draft S-1 filed; OpenAI preparing then postponing). "Out of private money" is
**contradicted** by the two largest private rounds on record in the same half-year [S48][S51]. Revenue is large and growing,
which cuts against "no value"; losses are also large, which supports "they need capital". The $4.6B 2025 revenue vs $65B
mid-2026 run-rate jump is extreme and rests on leaked/secondary figures — the article should present it as reported.

### 4.3 The "wall"
- Sutskever, NeurIPS 2024: "Pre-training as we know it will unquestionably end… We've achieved peak data and there'll be no
  more… There's only one internet"; he predicted next models would "be agentic in a real ways" [S53]. Nov 2025: the field is
  "moving from the age of scaling to the age of research" [S54].
- Data stock exhaustion projected 2026–2032; compute still growing ≈5×/year (A29 §9) [S62].
- Counter-evidence to "wall": METR horizons keep doubling every ≈4 months [S26][S27]; revenue run-rates grew several-fold in a
  year [S46]. Reconciliation: pre-training on human text is hitting limits; RL, test-time compute and tool use are where the
  gains moved — which is *why* the industry talks about agents. That part of Elder's E12 story ("they need a new story") has a
  technical counterpart: agents are the new scaling axis, not only a narrative.

### 4.4 Researcher departures (E9)
- **Yann LeCun** left Meta (reported Nov 2025) to found a world-model start-up; he "has previously called LLMs a 'dead end'"
  and said "We're never going to get to human-level A.I. by just training on text" (Harvard, Sept 2025) [S55]. **Supports E9 for Meta.**
- **Ilya Sutskever** left OpenAI in 2024 (SSI); he criticises generalisation, not tools (§4.3) [S53][S54]. Outside "the last year".
- **Jakub Pachocki** (OpenAI chief scientist) co-authored an OpenAI plan with Sam Altman in June 2026 (title seen in listing;
  page 403) [S63] — no evidence he quit.
- **John Jumper** (Nobel 2024) left Google DeepMind *for Anthropic* (2026-06-19) [S57] — a move between labs, not out of LLMs.
- **2026 safety departures:** Joe Benton (led a safety team at Anthropic), Josh Engels (Google safety research) and Jacob Coxon
  (Anthropic) left in Sept 2026 citing fears that progress could become "uncontrollable"; "There are no adults in the room"
  [S56]. **Their stated reason is the opposite of Elder's:** too much capability too fast, not a dead end.
- Verdict: E9 is **UNSUPPORTED** as stated ("all… quit… because LLMs are a dead end"); one prominent case fits.

### 4.5 Enterprise results and hype indicators
- **MIT NANDA, *The GenAI Divide: State of AI in Business 2025*:** "Despite $30–40 billion in enterprise investment into GenAI…
  95% of organizations are getting zero return"; for task-specific tools "Sixty percent… evaluated… only 20 percent reached
  pilot stage and just 5 percent reached production"; root cause "the learning gap, tools that don't learn, integrate poorly,
  or match workflows"; methods: 300+ public initiatives, 52 interviews, 153 survey responses, Jan–Jun 2025; success defined as
  "marked and sustained productivity and/or P&L impact" [S37]. Widely reported as "95% of pilots failing" [S38].
  Limitations visible in the report itself (dossier analysis): small, conference-recruited samples; "zero return" depends on a
  strict P&L definition; the 95% applies to *integrated task-specific* pilots, not all use; the authors' project promotes an
  agentic "NANDA" architecture, so the report argues *for* agents that learn — it is not an anti-agent finding.
- **Gartner (2025-06-25):** "over 40% of agentic AI projects will be canceled by end of 2027" (headline confirmed) [S39]. The
  release's reasons (cost, unclear value, risk controls), its "agent washing" estimate (≈130 genuine vendors among thousands)
  and its 2028 adoption forecasts were not readable (403) — **UNVERIFIED wording**.
- **Bull case (sourced):** revenue growth [S46][S47]; capability trend [S26][S27]; harness-driven gains on agent benchmarks
  [S25]. **Bear case (sourced):** pilot failure rates [S37]; cancellation forecasts [S39]; debt-funded capex and negative FCF
  [S40][S44]; benchmark contamination [S23]; weak/unstable productivity evidence [S28][S29]; valuation critiques [S50].

---

## 5. Terminology

| Source | Definition | Implication |
|---|---|---|
| Russell & Norvig (AIMA) | perceives via sensors, acts via actuators [S21] | "Agent" ≠ intelligence; a script with sensors qualifies |
| Anthropic | workflow = predefined code paths; agent = LLM directs its own process and tools [S14] | The line is *who chooses the next step* |
| LangChain (2026) | six-level autonomy spectrum by who decides output, next step, available steps [S20] | Ends the "is it really an agent" argument |
| OpenAI tool calling | five-step loop; your app executes [S16] | Mechanism, not marketing |
| Gartner | "agent washing" = relabelling assistants/RPA/chatbots [S39] (wording UNVERIFIED) | Elder's marketing critique has an analyst-industry name |
| CISA et al. | treats "LLM-based [AI], and [AI] agents" alongside "traditional statistical modeling and logic-based automation" in OT [S33] | Regulators regulate the system, not the label |

Note for the article: the CISA web page, when read on 2026-10-16, renders the title as "Super Intelligence in Operational
Technology" with "SI" throughout, while the URL slug and the PDF say "Artificial Intelligence" [S33]. Cite the PDF title.

**Elder's rename (E14).** "Generative computing" describes the drafter, not the loop. A more accurate engineering label for
what he describes is *LLM-orchestrated automation* (model = planner/router; code = executor). The video's own description
concedes "The language model is AI" [S1]; by Russell & Norvig the whole system is an agent [S21]. So "no AI in agentic AI" is
a definitional claim, not a factual one.

---

## 6. The engineering stance

### 6.1 Agent or script? (decision table; scorer in CALCULATORS C-i)

| Condition | Prefer |
|---|---|
| Input is structured, rule fits on a page, runs often | Script / workflow engine |
| Input is free text, logs, screenshots, varied documents | LLM step (classify, extract, draft) |
| Output can be checked mechanically (tests, schema, simulation, diff) | Agent loop with that check as the oracle |
| Error is costly and irreversible, check is weak | LLM proposes only; human approves; deterministic executor |
| Hard real-time or safety function | Never the LLM; PLC / SIS / BMS logic |
| Task repeats identically after the agent has solved it | Promote the solution to a script ("codify the path") |

### 6.2 Reference architecture
Probabilistic planner (LLM) → typed tool interface (schema validation, allow-list) → deterministic executors (scripts, APIs,
compilers) → verifiers (tests, lint, types, simulators, policy checks) → human gate for irreversible actions → audit log;
with budgets (steps, tokens, time, cost) enforced outside the model. The model never holds credentials directly and never
writes to safety-rated systems (§6.4) [S14][S31][S32][S33].

### 6.3 Worked example: the owner's software factory (as built, read 2026-10-16) [S60][S61]
- **Roles:** orchestrator (frontier model) → `spec-writer` → `builder` → 4 reviewers in parallel (`reviewer-security`,
  `reviewer-code`, `reviewer-ux`, `reviewer-ui`; UX/UI may answer SKIP only if no UI file changed) → `approver`. Sub-agents run on
  Sonnet, the approver on Haiku [S60].
- **State:** every transition is written by the `factory` CLI into `factory/board.json`; the orchestrator is told "never move a
  job forward on your own reading of a result — run the CLI and act on its STATUS line" [S60]. That is the probabilistic/
  deterministic split made explicit: LLMs write and judge; Python exit codes decide.
- **Deterministic gates (`factory gate`):** lint, test, build (shell exit codes, 900 s timeout); `secrets` (regex over added
  lines for key formats and private keys); `protected` (.env, *.pem, *.key, firebase.json, .github/workflows/*);
  `tests_added` (source changed but no test file changed → FAIL); `nonempty` (no diff → FAIL). `HARD_GATES = lint, test,
  build, nonempty, secrets` are "never overridable" [S60].
- **Review verdicts (`factory verdict`):** parsed by regex `VERDICT: PASS|FAIL|SKIP`; missing or unparseable → problem; an
  invalid SKIP is rejected; if HEAD moved after gating, verdicts are stale [S60].
- **Loop limits:** `max_fix_rounds` = 3; at most 2 `fix` decisions per job, then override or abandon; overrides refused while a
  hard gate fails [S60].
- **Delivery:** merge `--no-ff` inside the job worktree, re-run lint/test/build *on the merge result*, push fast-forward only
  and only if `"push": true` (opt-in per repo); local main moved only if that cannot clobber uncommitted work [S60].
- **Human in the loop:** `needs_human` defaults to false (orchestrator decides at DECIDE); when true, a security FAIL, a
  protected-file change or an exhausted fix loop stops at NEEDS_HUMAN [S60]. The owner's switches (`deliver`, `push`,
  `needs_human`) are declared off-limits to the agent [S60].
- **Observed run:** one demo job (2026-10-16, "readingTime" helper): 2 files changed (`src/text.js`, `test/text.test.js`); lint
  PASS, test PASS, build SKIP (not configured), secrets/protected/tests_added/nonempty PASS; reviews security PASS, code PASS,
  ux SKIP, ui SKIP [S61]. **No multi-job statistics exist**, so per-gate catch rates are unmeasured (UNVERIFIED); CALCULATORS
  C-iv treats them as user inputs.
- **What each gate catches (by construction):** compile/type/style errors (lint/build), behavioural regressions covered by
  tests (test), "done" claims with no code (nonempty), untested code (tests_added), credential leaks (secrets), changes to
  deployment/CI/secrets files (protected), merge-induced breakage (re-gate on merge), reviewer drift after new commits (HEAD
  check). **What no gate catches:** a wrong spec, tests that encode the same misunderstanding as the code, and correlated
  blind spots of same-family reviewer models.

### 6.4 Data-center / OT checklist ("put an agent on it")
Guidance anchors: CISA + ASD ACSC + NSA AISC + FBI + 5 partner agencies, *Principles for the Secure Integration of AI in OT*
(2025-12-03; PDF revision Jan 2026): Principle 1 Understand AI; 2 Consider AI Use in the OT Domain; 3 Establish AI Governance
and Assurance Frameworks; 4 Embed Oversight and Failsafe Practices; it advises to "Limit active control of OT infrastructure by
AI without a human in the loop to account for safety concerns and latency limitations" and to "Regularly update and validate
AI models" [S33]. NIST AI RMF 1.0 (released 2023-01-26; functions Govern, Map, Measure, Manage — function names not re-read) [S34];
ISO/IEC 42001:2023 AI management system (not re-read) [S35]; IEC 62443 for OT security zones/conduits and IEC 61511 for safety
instrumented systems (background, not read) [S36]; OWASP LLM and Agentic Top 10 [S31][S32].
1. **Read-only first.** Agent reads BMS/EPMS/DCIM trends, alarms, CMMS history; writes only to a ticket, a draft MOP or a chat.
2. **No autonomous write to OT/BMS/EPMS.** Any setpoint, mode or breaker change goes through the existing control system with
   its interlocks, a human approval and a change record [S33]. Safety functions (SIS, fire, EPO, leak detection trips) stay out
   of scope entirely [S36].
3. **One-way data path.** Agent sits on the IT side of the DMZ; OT data flows out via historian/replica; no inbound conduit
   from the agent's zone [S33][S36].
4. **Typed, allow-listed tools** with range checks (e.g. supply-air setpoint 18–27 °C enforced in code, not in the prompt).
5. **Deterministic verifier per action:** simulator, rule check, or second data source (e.g. confirm a "CRAH fault" from two
   sensors before raising a P1).
6. **Treat every document, ticket and alarm text as untrusted input** (prompt injection, OWASP LLM01/ASI01) [S31][S32].
7. **Budgets and kill switch:** max steps, max cost, wall-clock, and a manual disable that does not depend on the agent.
8. **Logging and replay** of prompts, tool calls and results for incident review (supports NIST "Measure/Manage") [S34].
9. **Evals before rollout:** a fixed set of historical incidents with known correct triage; track precision/recall per release.
10. **Codify what repeats:** once the agent's procedure for an alarm class is stable, turn it into a deterministic rule.

---

## 7. Claims checked (graded)

### 7.1 Elder's claims

| ID | Claim | Grade | Evidence |
|---|---|---|---|
| E1 | LLM = next-token predictor, autoregressive | **SUPPORTED** | A29 §2.7; vendor docs [S15][S16] |
| E2 | Doesn't understand words, numbers, logic, maths | **PARTLY** | No calculator module, unfaithful self-reports, fragility [S3][S7]; but causal evidence of learned arithmetic, multi-hop and planning circuits [S3][S4] |
| E3 | No memory, no logic, no reasoning; 2+2 is a guess | **PARTLY** | No weight memory at inference (true); context and external memory exist; "guess" is a distribution computed by circuits [S4]; reasoning gains on verifiable tasks [S8]; limits [S5][S12][S54] |
| E4 | A bare LLM cannot act on the internet | **SUPPORTED** | [S15][S16] |
| E5 | Agent = LLM emits a call, ordinary code runs it, result fed back | **SUPPORTED** (generic) / **UNSUPPORTED** (his example) | Docs [S15][S16]; Operator used a vision browser agent, not an API script [S58] |
| E6 | "The LLM did nothing" | **UNSUPPORTED** | The LLM does intent parsing, tool choice, argument filling, sequencing and recovery (§3.2); harness changes results [S25] |
| E7 | Decades-old automation | **PARTLY** | Executor half is old; general free-text/screen planning is new (§3.3) |
| E8 | $3 trillion of compute so far | **UNVERIFIED** | Big-four 2026 ≈ $0.70–0.74T (derived) [S40]–[S45] |
| E9 | All head researchers quit because LLMs are a dead end | **UNSUPPORTED** | LeCun yes [S55]; Pachocki remains [S63]; Jumper moved to Anthropic [S57]; 2026 departures cite safety [S56] |
| E10 | Hallucination will never improve much | **UNVERIFIED** (prediction) | Reliability gap persists: 80% horizon ≪ 50% horizon [S27] |
| E11 | Can't be used for serious coding; won't replace coders | **PARTLY** | 2025 RCT slowdown [S28]; 2026 weak evidence of speedup [S29]; ~80% on agent coding benchmarks with contamination caveats [S22][S23][S25]; replacement is a prediction |
| E12 | IPO story; private money exhausted | **PARTLY** | IPO prep real [S49][S52]; record private rounds contradict "out of money" [S48][S51] |
| E13 | Bordering on securities fraud | **UNSUPPORTED** | No evidence found; hedged by speaker [S1] |
| E14 | Rename to "generative/automated computing" | Opinion | Description concedes the LLM is AI [S1]; "agent washing" shows label abuse is real [S39] |

### 7.2 The owner's counter-claims

| ID | Claim | Grade | Evidence |
|---|---|---|---|
| C1 | The technical foundation of the critique is right | **SUPPORTED** | E1, E4, E5-generic [S15][S16] |
| C2 | LLM acts as a semantic router / dynamic planner over unstructured intent | **SUPPORTED** | Routing and agent definitions [S14][S20]; Operator CUA [S58] |
| C3 | Observe–act–reflect self-correction (run tests, read error, fix) is a genuine pattern | **SUPPORTED** as pattern, **PARTLY** as "new" | ReAct 2022 [S18]; "ground truth from the environment at each step" [S14]; closed-loop control is old |
| C4 | Probabilistic drafter + deterministic tools is a new design pattern | **PARTLY** | Generate-and-test is old; a general-purpose generator over code and text is new; harness effects measurable [S25] |
| C5 | Deterministic guardrails and human-in-the-loop are what matter | **SUPPORTED** | [S14][S31][S32][S33]; METR 50/80 gap [S27]; unfaithful CoT [S3] |
| C6 | "Fraud" is reductionist | **SUPPORTED** with a caveat | Mechanism description ≠ deception; but analyst-recognised "agent washing" [S39] and high pilot failure [S37] show the marketing critique has substance |

---

## 8. Claims checked and rejected or downgraded this session
- "OpenAI's restaurant agent called the OpenTable API from a Python script" → Operator drove a browser via a vision model [S58].
- "SWE-bench Verified ≈ 80% means agents fix 80% of real issues" → benchmark retired by OpenAI over flawed tests and
  contamination; figures reported via secondary [S23][S24].
- "METR shows AI slows developers 19%" as a current fact → superseded by METR's own Feb 2026 update [S29].
- 2026 ARC-AGI-2 scores of 88–95% → search snippets only, UNVERIFIED [S13].
- Gartner details (130 real vendors; 15%/33% 2028 forecasts) → page 403, UNVERIFIED [S39].
- Anthropic 2025 revenue $4.6B / net loss $42B → leaked prospectus via Reuters via CNBC, UNVERIFIED primary [S50].

---

## 9. Sources
Accessed 2026-10-16 unless noted. "Taken" = what was used.

| ID | Title / publisher | URL | Date of source | Taken |
|---|---|---|---|---|
| S1 | John Elder, "Agentic AI Is Fraud! We Need To Talk About It…" (YouTube; transcript via youtube-transcript-api, metadata via yt-dlp) | https://www.youtube.com/watch?v=eclfVFoDvlQ | 2026-08-27 | All quotes/timestamps, description, views |
| S2 | SectionZero, AI Operating System book page | https://sectionzero.ai/book | n.d. | Book claims |
| S3 | Anthropic, "Tracing the thoughts of a large language model" | https://www.anthropic.com/research/tracing-thoughts-language-model | 2025-03-27 | Mental maths, carry-the-1, faithfulness, Dallas, rhymes |
| S4 | Lindsey et al., "On the Biology of a Large Language Model" (Transformer Circuits) | https://transformer-circuits.pub/2025/attribution-graphs/biology.html | 2025-03 | 36+59 circuit, lookup features, planning, caveats |
| S5 | Shojaee et al., "The Illusion of Thinking" (Apple) | https://arxiv.org/abs/2506.06941 | 2025-06 | Collapse, effort decline, 3 regimes |
| S6 | A. Lawsen, "Comment on The Illusion of Thinking" | https://arxiv.org/abs/2506.09250 | 2025-06 | Token limits, impossible instances, generating functions |
| S7 | Mirzadeh et al., "GSM-Symbolic" (ICLR 2025) | https://arxiv.org/abs/2410.05229 | 2024-10 | "up to 65%", hypothesis quote |
| S8 | DeepSeek-AI, "DeepSeek-R1" | https://arxiv.org/abs/2501.12948 | 2025-01 (Nature version 2025) | Emergent reflection; AIME figures (not re-read) |
| S9 | Bender et al., "On the Dangers of Stochastic Parrots" (FAccT '21) | https://dl.acm.org/doi/10.1145/3442188.3445922 | 2021-03 | Definition quote (not re-read; 403) |
| S10 | F. Chollet, "On the Measure of Intelligence" | https://arxiv.org/abs/1911.01547 | 2019-11 | Skill-acquisition efficiency |
| S11 | ARC Prize, ARC-AGI-2 page | https://arcprize.org/arc-agi/2/ | 2025 | Human calibration, dataset sizes |
| S12 | ARC Prize, "ARC Prize 2025 results & analysis" | https://arcprize.org/blog/arc-prize-2025-results-analysis | 2025-12 | 24%, 37.6%, 54%, costs |
| S13 | Kaggle ARC Prize 2026 leaderboard; benchlm.ai (search snippets only) | https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-2/leaderboard | 2026-10 | UNVERIFIED 2026 scores |
| S14 | Anthropic, "Building effective agents" | https://www.anthropic.com/engineering/building-effective-agents | 2024-12-19 | Definitions, simplest-solution, compounding errors, sandbox |
| S15 | Anthropic docs, Tool use overview | https://docs.claude.com/en/docs/agents-and-tools/tool-use/overview | 2026 | Client vs server tools, tool_result |
| S16 | OpenAI docs, Function calling guide | https://platform.openai.com/docs/guides/function-calling | 2026 | Five-step flow |
| S17 | Schick et al., "Toolformer" | https://arxiv.org/abs/2302.04761 | 2023-02 | Self-taught API calls |
| S18 | Yao et al., "ReAct" (A29 [S42]) | https://arxiv.org/abs/2210.03629 | 2022-10 | Reason-act-observe |
| S19 | Model Context Protocol specification (A29 [S61]) | https://modelcontextprotocol.io/specification | rev. 2026-07-28 | Tools = arbitrary code execution |
| S20 | LangChain (J. Ou), "What is an AI agent?" | https://blog.langchain.com/what-is-an-agent/ | 2026-07-31 | Autonomy spectrum, loop components |
| S21 | Russell & Norvig, *Artificial Intelligence: A Modern Approach*, 4th ed., ch. 2 | https://aima.cs.berkeley.edu/ | 2020 | Agent definition (not re-read) |
| S22 | SWE-bench leaderboards.json | https://raw.githubusercontent.com/SWE-bench/swe-bench.github.io/master/data/leaderboards.json | read 2026-10-16 | Verified top entries |
| S23 | OpenAI, "Why we no longer evaluate SWE-bench Verified" (403) | https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/ | 2026-02 | Retirement (figures via S24/snippets) |
| S24 | Decrypt, "OpenAI Says Benchmark… Is 'Contaminated'" | https://decrypt.co/359012/openai-benchmark-measure-ai-coding-supremacy-contaminated | 2026-02-24 | ~70%→~23% on Pro |
| S25 | Terminal-Bench 2.0 leaderboard (Snorkel mirror; tbench.ai) | https://snorkel.ai/leaderboard/terminal-bench-2-0/ | 2026-10 | Top entries, 89 tasks |
| S26 | METR, "Time Horizon 1.1" | https://metr.org/blog/2026-1-29-time-horizon-1-1/ | 2026-01-29 | Suite size, 131-day doubling |
| S27 | METR, Task-Completion Time Horizons page + benchmark_results_1_1.yaml | https://metr.org/time-horizons/ ; https://metr.org/assets/benchmark_results_1_1.yaml | last updated 2026-09-08 | Model p50/p80, 128.7-day doubling, >16 h caveat |
| S28 | METR, early-2025 developer RCT | https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/ | 2025-07-10 | 19% slowdown (via S29 text) |
| S29 | METR, "We are Changing our Developer Productivity Experiment Design" | https://metr.org/blog/2026-02-24-uplift-update/ | 2026-02-24 | Follow-up estimates, selection effects |
| S30 | Anthropic, "Agentic Misalignment" | https://www.anthropic.com/research/agentic-misalignment | 2025-06 | Blackmail rates, simulation caveat |
| S31 | OWASP, LLM01:2025 Prompt Injection | https://genai.owasp.org/llmrisk/llm01-prompt-injection/ | 2025 | Indirect injection, impacts |
| S32 | OWASP, Top 10 for Agentic Applications 2026 | https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/ | 2025-12-09 | ASI01–ASI10 |
| S33 | CISA, ASD ACSC et al., Principles for the Secure Integration of AI in OT (page + PDF v2) | https://www.cisa.gov/resources-tools/resources/principles-secure-integration-artificial-intelligence-operational-technology | 2025-12-03 (PDF 2026-01) | Four principles, HITL quote |
| S34 | NIST, AI Risk Management Framework | https://www.nist.gov/itl/ai-risk-management-framework | 2023-01-26 | Release date; functions (not re-read) |
| S35 | ISO/IEC 42001:2023 | https://www.iso.org/standard/42001 | 2023 | AI management system (not re-read; 403) |
| S36 | IEC 62443 series; IEC 61511 (background) | https://www.isa.org/standards-and-publications/isa-standards/isa-iec-62443-series-of-standards | — | Zones/conduits, SIS (not read) |
| S37 | MIT NANDA, *The GenAI Divide: State of AI in Business 2025* (PDF) | https://mlq.ai/media/quarterly_decks/v0.1_State_of_AI_in_Business_2025_Report.pdf | 2025-07/08 | 95%, 60/20/5, methods, learning gap |
| S38 | Fortune, "95% of generative AI pilots at companies are failing" | https://fortune.com/2025/08/18/mit-report-95-percent-generative-ai-pilots-at-companies-failing-cfo/ | 2025-08-18 | Popular framing |
| S39 | Gartner press release (403; headline via HN listing) | https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027 | 2025-06-25 | 40% headline; rest UNVERIFIED |
| S40 | CNBC, "Amazon, Meta, Microsoft face skeptical investors…" | https://www.cnbc.com/2026/07/28/hyperscalers-face-higher-capex-scrutiny-after-alphabet-report-panned.html | 2026-07-28 | MSFT $190B, AMZN $200B, debt figures |
| S41 | Business Insider, "Microsoft keeps capex unchanged" | https://www.businessinsider.com/microsoft-ai-capex-unchanged-data-centers-spending-tech-giants-2026-7 | 2026-07-29 | $190B held, $175B restated |
| S42 | CNBC, Alphabet Q2 2026 live updates | https://www.cnbc.com/2026/07/22/google-earnings-q2-goog-live-updates.html | 2026-07-22 | $195–205B |
| S43 | Meta Platforms Q2 2026 results, 8-K Ex. 99.1 (SEC) | https://www.sec.gov/Archives/edgar/data/1326801/000162828026050596/meta-06302026xexhibit991.htm | 2026-07-29 | $130–145B |
| S44 | Amazon.com Q2 2026 earnings release | https://s2.q4cdn.com/299287126/files/doc_earnings/2026/q2/earnings-result/AMZN-Q2-2026-Earnings-Release.pdf | 2026-07-30 | P&E $54.2B Q2, $98.4B H1, FCF −$7.6B TTM |
| S45 | Fortune, Meta raises 2026 capex to $125–145B | https://fortune.com/2026/04/29/meta-zuckerberg-145-billion-ai-spending-roi/ | 2026-04-29 | Prior range |
| S46 | CNBC, Anthropic run-rate $65B | https://www.cnbc.com/2026/08/17/anthropic-says-annualized-revenue-climbed-to-65-billion-in-july.html | 2026-08-17 | $65B, ~7× |
| S47 | CNBC, OpenAI revenue $20B lower than signalled | https://www.cnbc.com/2026/10/08/open-ai-revenue-nvidia-oracle-coreweave.html | 2026-10-08 | ~$50B vs $68B |
| S48 | Anthropic, Series H | https://www.anthropic.com/news/series-h | 2026-05-28 | $65B at $965B |
| S49 | Anthropic, confidential draft S-1 | https://www.anthropic.com/news/confidential-draft-s1-sec | 2026-06-01 | Filing |
| S50 | CNBC, New Constructs on Anthropic IPO (cites Reuters leaked prospectus) | https://www.cnbc.com/2026/10/07/anthropic-will-be-most-ridiculous-ipo-of-year-analyst-says.html | 2026-10-07 | $4.6B / −$42B (UNVERIFIED), $150B view |
| S51 | CNBC, OpenAI closes $122B round at $852B | https://www.cnbc.com/2026/03/31/openai-funding-round-ipo.html | 2026-03-31 | Round size |
| S52 | PYMNTS (citing Fortune interview), OpenAI IPO not in 2026 | https://www.pymnts.com/news/2026/openai-pauses-ipo-plans-amid-ai-safety-worries/ | 2026-09-13 | Altman quote |
| S53 | The Verge, Sutskever at NeurIPS 2024 | https://www.theverge.com/2024/12/13/24320811/what-ilya-sutskever-sees-openai-model-data-training | 2024-12-13 | Pre-training end, peak data |
| S54 | Dwarkesh Podcast, Ilya Sutskever | https://www.dwarkesh.com/p/ilya-sutskever-2 | 2025-11-25 | Age of research; generalisation quote |
| S55 | Observer, LeCun to leave Meta | https://observer.com/2025/11/yann-lecun-leave-meta-launch-world-models-startup/ | 2025-11-11 | Dead-end quote, Harvard quote |
| S56 | NBC News, researchers leave Anthropic and Google over safety | https://www.nbcnews.com/tech/security/two-ai-researchers-leave-anthropic-google-safety-concerns-rcna597086 | 2026-09-10 | Benton, Engels, Coxon |
| S57 | Business Insider, John Jumper leaves DeepMind for Anthropic | https://www.businessinsider.com/alphafold-john-jumper-leaves-google-deepmind-anthropic-demis-hassabis-nobel-2026-6 | 2026-06-19 | Move |
| S58 | TechCrunch, "OpenAI launches Operator" | https://techcrunch.com/2025/01/23/openai-launches-operator-an-ai-agent-that-performs-tasks-autonomously/ | 2025-01-23 | CUA, no APIs, confirmation, partners |
| S59 | Article 29 dossier (internal) | Article/Article_29/RESEARCH.md | 2026-10-16 | Prices $2/$10 per M, cache 10%, mechanism sections |
| S60 | Factory skill and CLI (local) | ~/.claude/skills/factory/SKILL.md ; ~/.claude/skills/factory/bin/factory | read 2026-10-16 | Roles, gates, limits, delivery |
| S61 | Factory demo job board (local) | scratchpad demo/app/factory/jobs/20261016-2114-reading-time/board.json | 2026-10-16 | Gate and review results |
| S62 | Epoch AI data (A29 [S41][S64]) | https://epoch.ai/data | 2026 | Data wall, compute trend |
| S63 | OpenAI, "Built to benefit everyone: our plan" by Sam Altman and Jakub Pachocki (title via listing; page 403) | https://openai.com/index/built-to-benefit-everyone-our-plan/ | 2026-06-09 | Pachocki still at OpenAI |
