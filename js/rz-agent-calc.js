/* rz-agent-calc.js — the four calculators of article 30 ("Is 'Agentic AI' a Fraud?").
 *
 *   RZAgentCalc.decide(inputs)       C-i   agent-or-script decision scorer (judgement aid)
 *   RZAgentCalc.reliability(inputs)  C-ii  run cost and reliability with compounding error
 *   RZAgentCalc.budget(inputs)       C-iii tool-loop budget planner (money, wall clock, context)
 *   RZAgentCalc.ladder(inputs)       C-iv  verification-ladder coverage (catch rates are user assumptions)
 *   RZAgentCalc.mount(root)          renders every [data-agent-calc] element under root
 *
 * The four compute functions are pure: object in, object out, no DOM. Every output is
 * {value, unit, formula, inputs}. Every constant lives in RZAgentCalc.constants with its
 * source ([Sn] tags resolve in Article/Article_30/RESEARCH.md section 9). Spec:
 * Article/Article_30/CALCULATORS.md. Out-of-range or non-numeric input gives valid:false
 * and NaN outputs (the UI prints a dash); nothing is silently clamped.
 * ES5, zero dependencies; uses window.RZCalc (js/rz-calc-utils.js) for validation + CSV.
 */
(function (root) {
  "use strict";
  var win = root;
  if (win.RZAgentCalc) return;

  var ASOF = "2026-10-16";

  /* ---------------------------------------------------------------- constants */
  var constants = {};
  function K(key, value, unit, source, note) {
    constants[key] = { value: value, unit: unit, source: source, asOf: ASOF, note: note || "" };
  }
  var LIST = "A29 [S27] via [S59]";
  K("price.in", 2.0, "$ per 1M input tokens", LIST, "Sonnet-class list price, 2026-10-16");
  K("price.out", 10.0, "$ per 1M output tokens", LIST, "Sonnet-class list price, 2026-10-16");
  K("price.cacheReadFrac", 0.1, "fraction of input price", LIST, "cache reads are 2.5-10% across vendors; 10% used");
  K("ttft", 0.5, "s", "assumption (A29 section 8.2)", "time to first token");
  K("tpot", 0.02, "s per output token", "assumption (A29 section 8.2)", "time per output token");
  K("ctxWindow", 200000, "tokens", "assumption (A29 section 8.5)", "common default; 1M windows exist");
  K("compactFrac", 0.8, "fraction of window", "CALCULATORS.md C-iii (design choice)", "compaction threshold");
  K("decide.lat_weight", 0.5, "weight", "CALCULATORS.md C-i (dossier design choice)", "judgement aid, not a measurement");
  K("decide.band_hybrid", 35, "score", "CALCULATORS.md C-i (dossier design choice)", "below: script / workflow");
  K("decide.band_agent", 65, "score", "CALCULATORS.md C-i (dossier design choice)", "from here: agent loop with verifiers");
  K("ladder.rho", 0.5, "fraction", "assumption (CALCULATORS.md C-iv)", "default correlation factor for a gate sharing the generator's model family");

  function cv(key) { return constants[key].value; }

  var presets = { ladders: {}, examples: {} };
  presets.ladders["Default ladder (illustrative, ASSUMPTION)"] = {
    g1_name: "tests", g1_d: 0.6, g1_hard: "hard", g2_name: "lint", g2_d: 0.1, g2_hard: "hard",
    g3_name: "type check", g3_d: 0.15, g3_hard: "hard", g4_name: "LLM code review", g4_d: 0.5, g4_hard: "advisory",
    g5_name: "human gate", g5_d: 0.5, g5_hard: "hard", g6_name: "", g6_d: 0, g6_hard: "advisory", g7_name: "", g7_d: 0, g7_hard: "advisory"
  };
  presets.ladders["Factory-shaped ladder (mirrors gate order [S60]; values not measured)"] = {
    g1_name: "tests", g1_d: 0.6, g1_hard: "hard", g2_name: "lint", g2_d: 0.1, g2_hard: "hard",
    g3_name: "tests_added", g3_d: 0, g3_hard: "hard", g4_name: "security review", g4_d: 0.4, g4_hard: "advisory",
    g5_name: "code review", g5_d: 0.4, g5_hard: "advisory", g6_name: "ux", g6_d: 0.2, g6_hard: "advisory", g7_name: "ui", g7_d: 0.2, g7_hard: "advisory"
  };
  presets.examples.decide = {
    "BMS alarm triage summary for the shift lead": { V: 4, E: 4, Vf: 3, F: 5, L: 3 },
    "Code change with a test suite": { V: 4, E: 2, Vf: 5, F: 3, L: 5 },
    "Monthly PUE report from the historian": { V: 1, E: 2, Vf: 5, F: 2, L: 5 },
    "Chiller setpoint write": { V: 3, E: 5, Vf: 2, F: 4, L: 2 },
    "CMMS work-order drafting from technician notes": { V: 5, E: 2, Vf: 3, F: 4, L: 4 },
    "MOP/SOP lookup Q&A": { V: 5, E: 3, Vf: 3, F: 4, L: 4 }
  };

  /* ------------------------------------------------------- field definitions */
  function fld(key, label, unit, def, min, max, step, explain, opts) {
    var f = { key: key, label: label, unit: unit, scale: 1, def: def, min: min, max: max, step: step, explain: explain };
    if (opts) for (var k in opts) f[k] = opts[k];
    return f;
  }
  function enm(key, label, def, options, explain) { return { key: key, label: label, type: "enum", def: def, options: options, explain: explain }; }
  function txt(key, label, def, explain) { return { key: key, label: label, type: "text", def: def, explain: explain }; }
  function opt(v, l) { return { value: v, label: l }; }
  function chooser(id, label, map) {
    var o = [], n;
    for (n in map) if (map.hasOwnProperty(n)) o.push({ label: n, set: map[n] });
    return { id: id, label: label, options: o };
  }

  var DECIDE_FIELDS = [
    fld("V", "V: variability of input (1 fixed format, 5 free text)", "1-5", 3, 1, 5, 1, "agent-v", { int: true }),
    fld("E", "E: cost of an error (1 trivial, 5 safety or outage)", "1-5", 3, 1, 5, 1, "agent-e", { int: true }),
    fld("Vf", "Vf: verifiability (1 no check, 5 deterministic oracle)", "1-5", 3, 1, 5, 1, "agent-vf", { int: true }),
    fld("F", "F: frequency (1 rare, 5 many times a day)", "1-5", 3, 1, 5, 1, "agent-f", { int: true }),
    fld("L", "L: latency budget (1 real-time, 5 minutes or more)", "1-5", 3, 1, 5, 1, "agent-l", { int: true })
  ];
  var DECIDE_CHOOSERS = [chooser("example", "Worked example (CALCULATORS.md C-i)", presets.examples.decide)];

  var REL_FIELDS = [
    fld("n", "Steps per run n", "", 20, 1, 200, 1, "agent-steps", { int: true }),
    fld("p", "Per-step success p", "0.5-0.9999", 0.95, 0.5, 0.9999, "any", "agent-p-step"),
    fld("d", "Verifier detection rate d (0 = no verifier)", "0-1", 0.9, 0, 1, 0.01, "agent-d-detect"),
    fld("k", "Retries per step k", "0-5", 2, 0, 5, 1, "agent-retries", { int: true }),
    fld("Tin", "Input tokens per attempt", "tokens", 40000, 0, 5e6, 1000, "agent-t-in"),
    fld("Tout", "Output tokens per attempt", "tokens", 800, 0, 1e6, 100, "agent-t-out"),
    fld("c", "Cached input share c", "0-0.95", 0, 0, 0.95, 0.05, "agent-cached"),
    fld("target", "Target run success (for the required per-step success)", "0.01-0.999", 0.9, 0.01, 0.999, "any", "agent-target")
  ];

  var BUD_FIELDS = [
    fld("c0", "Initial context c0", "tokens", 20000, 0, 1e6, 1000, "agent-c0"),
    fld("g", "Context growth per step g", "tokens", 3000, 1, 1e6, 100, "agent-growth"),
    fld("o", "Output per step o", "tokens", 800, 0, 1e6, 100, "agent-out-step"),
    fld("C", "Cost cap C", "USD", 5, 0.01, 1e5, 0.5, "agent-cost-cap"),
    fld("Tw", "Wall-clock cap Tw", "s", 600, 1, 86400, 10, "agent-wall-cap"),
    fld("tt", "Tool latency per step tt", "s", 5, 0, 3600, 1, "agent-tool-latency"),
    fld("f", "Cached input share f", "0-0.95", 0, 0, 0.95, 0.05, "agent-cached"),
    fld("S_policy", "Policy cap on steps S_policy", "steps", 100, 1, 10000, 1, "agent-policy", { int: true }),
    fld("timeout_x", "Per-step timeout multiplier", "x t_step", 3, 1, 20, 0.5, "agent-timeout-x")
  ];

  var NGATE = 7;
  var LADDER_FIELDS = [fld("rho", "Correlation factor ρ (gates sharing the generator's model family)", "0-1", cv("ladder.rho"), 0, 1, 0.05, "agent-rho")];
  (function () {
    var i, d = presets.ladders["Default ladder (illustrative, ASSUMPTION)"], p;
    for (i = 1; i <= NGATE; i++) {
      p = "g" + i + "_";
      LADDER_FIELDS.push(txt(p + "name", "Gate " + i + " name", d[p + "name"], "agent-gate-name"));
      LADDER_FIELDS.push(fld(p + "d", "Gate " + i + " catch rate (ASSUMPTION)", "0-1", d[p + "d"], 0, 1, 0.05, "agent-gate-catch"));
      LADDER_FIELDS.push(enm(p + "shared", "Gate " + i + " shares the generator's model family", "no", [opt("no", "no (independent)"), opt("yes", "yes (correlated)")], "agent-gate-shared"));
      LADDER_FIELDS.push(enm(p + "hard", "Gate " + i + " kind", d[p + "hard"], [opt("hard", "hard (cannot be overridden)"), opt("advisory", "advisory")], "agent-gate-hard"));
    }
  })();
  var LADDER_CHOOSERS = [chooser("preset", "Ladder preset (what-ifs, not measurements)", presets.ladders)];

  /* ------------------------------------------------------------ validation */
  function toNum(raw) {
    if (typeof raw === "number") return raw;
    if (typeof raw === "string" && raw.replace(/\s/g, "") !== "") return Number(raw);
    return NaN;
  }
  function resolve(fields, inp) {
    var v = {}, errors = [], k, f, raw, n, j, ok;
    inp = inp || {};
    for (k = 0; k < fields.length; k++) {
      f = fields[k];
      raw = inp[f.key] !== undefined ? inp[f.key] : f.def;
      if (f.type === "text") {
        if (typeof raw !== "string") errors.push({ key: f.key, msg: f.label + " must be text" });
        v[f.key] = raw;
        continue;
      }
      if (f.type === "enum") {
        ok = false;
        for (j = 0; j < f.options.length; j++) if (f.options[j].value === raw) ok = true;
        if (!ok) errors.push({ key: f.key, msg: f.label + " is not a valid choice" });
        v[f.key] = raw;
        continue;
      }
      n = toNum(raw);
      if (!isFinite(n)) errors.push({ key: f.key, msg: f.label + " is required and must be a number" });
      else if (n < f.min || n > f.max) errors.push({ key: f.key, msg: f.label + " must be " + f.min + " to " + f.max });
      else if (f.int && Math.floor(n) !== n) errors.push({ key: f.key, msg: f.label + " must be a whole number" });
      v[f.key] = n;
    }
    return { v: v, errors: errors };
  }

  /* ----------------------------------------------------------- output plumbing */
  function O(key, label, unit, formula, ins) { return { key: key, label: label, unit: unit, formula: formula, ins: ins || [] }; }

  function run(def, inp) {
    var r = resolve(def.fields, inp), errors = r.errors, vals = null, notes = [], out = {}, k, m, ins, j, valid;
    if (!errors.length && def.cross) errors = def.cross(r.v);
    valid = errors.length === 0;
    if (valid) { vals = def.compute(r.v); notes = def.notes ? def.notes(r.v, vals) : []; }
    for (k = 0; k < def.out.length; k++) {
      m = def.out[k];
      ins = {};
      for (j = 0; j < m.ins.length; j++) ins[m.ins[j]] = r.v[m.ins[j]];
      out[m.key] = { value: valid ? vals[m.key] : NaN, unit: m.unit, formula: m.formula, inputs: ins, label: m.label };
    }
    return { id: def.id, valid: valid, errors: errors, out: out, basis: def.basis, notes: notes, inputs: r.v };
  }

  /* ------------------------------------------------------------- C-i decide */
  var SCRIPT = "Script / workflow", HYBRID = "Hybrid", AGENT = "Agent loop with verifiers";
  var DECIDE = {
    id: "decide", fields: DECIDE_FIELDS,
    basis: "model — illustrative judgement aid; the weights and bands are the dossier's design choices, not measurements",
    out: [
      O("N", "Need for language understanding N", "0..1", "N = (V − 1) / 4", ["V"]),
      O("Risk", "Residual risk after verification", "0..1", "Risk = ((E − 1) / 4) · (1 − (Vf − 1) / 4)", ["E", "Vf"]),
      O("Lp", "Latency penalty Lp", "0..1", "Lp = (5 − L) / 4", ["L"]),
      O("score", "Score", "0-100", "Score = 100 · N · (1 − Risk) · (1 − 0.5·Lp)", ["V", "E", "Vf", "L"]),
      O("band", "Band from the score", "", "Score < 35: Script / workflow; 35 ≤ Score < 65: Hybrid; Score ≥ 65: Agent loop with verifiers", ["V", "E", "Vf", "L"]),
      O("decision", "Decision after overrides", "", "Override 3 (V ≤ 2) and override 2 (L = 1) force Script / workflow", ["V", "E", "Vf", "L"]),
      O("flags", "Red flags", "", "Override 1: E = 5 and Vf ≤ 2; override 2: L = 1; note 4: F ≥ 4 and V ≤ 3", ["V", "E", "Vf", "F", "L"]),
      O("rationale", "Why", "", "Rationale names the largest of 1 − N, Risk and 0.5·Lp", ["V", "E", "Vf", "L"])
    ],
    compute: function (v) {
      var N = (v.V - 1) / 4, Risk = ((v.E - 1) / 4) * (1 - (v.Vf - 1) / 4), Lp = (5 - v.L) / 4;
      var score = 100 * N * (1 - Risk) * (1 - cv("decide.lat_weight") * Lp);
      var band = score < cv("decide.band_hybrid") ? SCRIPT : (score < cv("decide.band_agent") ? HYBRID : AGENT);
      var decision = band, flags = [], why, a = 1 - N, b = Risk, c = cv("decide.lat_weight") * Lp;
      if (v.E === 5 && v.Vf <= 2) flags.push("No autonomous action. LLM may propose; a human executes through the existing control system (CISA AI-in-OT HITL principle [S33]).");
      if (v.L === 1) { flags.push("Real-time path: not an LLM (decode latency, A29 section 6)."); decision = SCRIPT; }
      if (v.V <= 2) decision = SCRIPT;
      if (v.F >= 4 && v.V <= 3) flags.push("Codify: once the agent's path is stable, replace it with a script.");
      if (v.V <= 2) why = "Script regardless of score: the input is so regular (V = " + v.V + ") that a rule fits on a page.";
      else if (b >= a && b >= c) why = (decision === AGENT ? "Risk is the largest remaining drag" : "Low score because errors are costly and hard to check") + " (Risk = " + b.toFixed(3) + ").";
      else if (a >= c) why = (decision === AGENT ? "Language understanding is the largest remaining drag" : "Low score because the input is regular enough that little language understanding is needed") + " (1 − N = " + a.toFixed(3) + ").";
      else why = (decision === AGENT ? "Latency is the largest remaining drag" : "Low score because the latency budget is tight") + " (0.5·Lp = " + c.toFixed(3) + ").";
      return { N: N, Risk: Risk, Lp: Lp, score: score, band: band, decision: decision, flags: flags.length ? flags.join(" | ") : "none", rationale: why };
    },
    notes: function () {
      return ["Judgement aid, not a measurement: the weights and the 35 / 65 bands are the dossier's design choices.",
        "Hybrid means the LLM classifies, extracts or drafts; deterministic code validates and executes; a human approves side effects."];
    }
  };

  /* ------------------------------------------------------- C-ii reliability */
  function attemptCost(Tin, Tout, c) {
    return Tin * ((1 - c) * cv("price.in") + c * cv("price.in") * cv("price.cacheReadFrac")) / 1e6 + Tout * cv("price.out") / 1e6;
  }
  function stepModel(p, d, k) {
    var q = (1 - p) * d, E = q === 0 ? 1 : (1 - Math.pow(q, k + 1)) / (1 - q);
    return { q: q, E: E, Ps: p * E, Pu: (1 - p) * (1 - d) * E, Px: Math.pow(q, k + 1) };
  }
  var RELI = {
    id: "reliability", fields: REL_FIELDS,
    basis: "model — illustrative (independent steps, optimistic); token prices are list price on " + ASOF + " " + LIST,
    out: [
      O("q", "Bad and detected per attempt q", "probability", "q = (1 − p) · d", ["p", "d"]),
      O("E", "Expected attempts per step E", "attempts", "E = (1 − q^(k+1)) / (1 − q)", ["p", "d", "k"]),
      O("Ps", "Step succeeds Ps", "probability", "Ps = p · E", ["p", "d", "k"]),
      O("Pu", "Step fails silently, Pu: the dangerous case", "probability", "Pu = (1 − p)(1 − d) · E", ["p", "d", "k"]),
      O("Px", "Step exhausts retries, Px: caught, safe", "probability", "Px = q^(k+1)", ["p", "d", "k"]),
      O("check", "Check Ps + Pu + Px", "", "check: Ps + Pu + Px = 1", ["p", "d", "k"]),
      O("P_run", "Run succeeds P_run", "probability", "P_run = Ps^n", ["n", "p", "d", "k"]),
      O("retries", "Expected retries per run", "retries", "retries = n · (E − 1)", ["n", "p", "d", "k"]),
      O("cost_att", "Cost per attempt", "USD", "cost_att = Tin·[(1−c)·price.in + c·price.in·price.cacheReadFrac]/1e6 + Tout·price.out/1e6", ["Tin", "Tout", "c"]),
      O("cost_run", "Cost per run (upper bound)", "USD", "cost_run = n · E · cost_att", ["n", "p", "d", "k", "Tin", "Tout", "c"]),
      O("cost_per_success", "Cost per successful run", "USD", "cost_per_success = cost_run / P_run", ["n", "p", "d", "k", "Tin", "Tout", "c"]),
      O("p_needed", "Per-step success needed for the target", "probability", "p_needed(target, n) = target^(1/n)", ["target", "n"])
    ],
    compute: function (v) {
      var s = stepModel(v.p, v.d, v.k), ca = attemptCost(v.Tin, v.Tout, v.c), prun = Math.pow(s.Ps, v.n), crun = v.n * s.E * ca;
      return { q: s.q, E: s.E, Ps: s.Ps, Pu: s.Pu, Px: s.Px, check: s.Ps + s.Pu + s.Px, P_run: prun,
        retries: v.n * (s.E - 1), cost_att: ca, cost_run: crun, cost_per_success: crun / prun,
        p_needed: Math.pow(v.target, 1 / v.n) };
    },
    notes: function (v, o) {
      var base = Math.pow(v.p, v.n), extra = base > 0 ? o.cost_run / (v.n * attemptCost(v.Tin, v.Tout, v.c)) - 1 : NaN;
      return ["With your inputs a run succeeds " + (o.P_run * 100).toFixed(1) + "% of the time, against " + (base * 100).toFixed(1) +
        "% with no verifier and no retries, for " + (extra * 100).toFixed(1) + "% more tokens.",
        "At the defaults (20 steps, p = 0.95, d = 0.9, k = 2): a verifier that catches 90% of bad steps raises a 20-step run from 36% to 90% for 5% more tokens. The cheapest reliability is a deterministic check, not a bigger model.",
        "Caveats: independence is optimistic (errors correlate); a model-based verifier may share the generator's blind spots; METR's 50%-vs-80% time-horizon gap (Mythos 1,045 vs 186 min; Opus 4.6 719 vs 70 min) is the empirical version of this curve [S27].",
        "Silent failure (Pu) and detected failure (Px) mean different things: Px stops the run and can be escalated; Pu ships a wrong result."];
    }
  };

  /* --------------------------------------------------------------- C-iii budget */
  function pinEff(f) { return cv("price.in") * (1 - f) + cv("price.in") * cv("price.cacheReadFrac") * f; }
  function costAt(v, S) { return pinEff(v.f) * (S * v.c0 + v.g * S * (S - 1) / 2) / 1e6 + cv("price.out") * S * v.o / 1e6; }
  function stepsByCost(v) {
    var pe = pinEff(v.f), a = pe * v.g / 2 / 1e6, b = (pe * (v.c0 - v.g / 2) + cv("price.out") * v.o) / 1e6, S;
    S = a > 0 ? (-b + Math.sqrt(b * b + 4 * a * v.C)) / (2 * a) : v.C / b;
    return S;
  }
  var BUD_CURVE = [10, 20, 30, 40, 60];
  var BUD = {
    id: "budget", fields: BUD_FIELDS,
    basis: "model — illustrative; token prices are list price on " + ASOF + " " + LIST + "; TTFT, TPOT and window are assumptions",
    cross: function (v) {
      if (v.c0 >= cv("compactFrac") * cv("ctxWindow")) return [{ key: "c0", msg: "Initial context c0 is already past the compaction threshold (80% of the window)" }];
      return [];
    },
    out: (function () {
      var o = [
        O("pin_eff", "Effective input price", "$ per 1M", "pin_eff = price.in·(1−f) + price.in·price.cacheReadFrac·f", ["f"]),
        O("S_cost_raw", "Steps the cost cap allows, continuous", "steps", "S_cost = largest S with Cost(S) ≤ C: solve a·S² + b·S − C = 0", ["c0", "g", "o", "C", "f"]),
        O("S_cost", "S_cost: steps the cost cap allows", "steps", "S_cost = largest S with Cost(S) ≤ C: solve a·S² + b·S − C = 0", ["c0", "g", "o", "C", "f"]),
        O("t_step", "Time per step", "s", "t_step = ttft + o·tpot + tt", ["o", "tt"]),
        O("S_time", "S_time: steps the wall clock allows", "steps", "S_time = floor(Tw / t_step)", ["Tw", "o", "tt"]),
        O("S_ctx", "S_ctx: step at which compaction is needed", "steps", "S_ctx = floor((0.8·W − c0)/g) + 1", ["c0", "g"]),
        O("max_steps", "max_steps", "steps", "max_steps = min(S_cost, S_time, S_ctx, S_policy)", ["c0", "g", "o", "C", "Tw", "tt", "f", "S_policy"]),
        O("binding", "Binding limit", "", "binding = the term of min(S_cost, S_time, S_ctx, S_policy) that equals max_steps", ["c0", "g", "o", "C", "Tw", "tt", "f", "S_policy"]),
        O("step_timeout", "Suggested per-step timeout", "s", "per-step timeout = 3 · t_step (3 is the default multiplier, user-editable)", ["timeout_x", "o", "tt"]),
        O("cost_at_max", "Cost at max_steps", "USD", "Cost(S) = pin_eff·[S·c0 + g·S(S−1)/2]/1e6 + price.out·S·o/1e6", ["c0", "g", "o", "f"]),
        O("ctx_at_max", "Context at the last step", "tokens", "context at step S = c0 + (S − 1)·g", ["c0", "g"]),
        O("input_at_max", "Input tokens re-sent over the run", "tokens", "input tokens to step S (cumulative) = S·c0 + g·S(S−1)/2", ["c0", "g"])
      ], i;
      for (i = 0; i < BUD_CURVE.length; i++) o.push(O("cost_" + BUD_CURVE[i], "Cost at " + BUD_CURVE[i] + " steps", "USD", "Cost(S) = pin_eff·[S·c0 + g·S(S−1)/2]/1e6 + price.out·S·o/1e6", ["c0", "g", "o", "f"]));
      return o;
    })(),
    compute: function (v) {
      var raw = stepsByCost(v), Sc = Math.floor(raw + 1e-9), tstep = cv("ttft") + v.o * cv("tpot") + v.tt, St = Math.floor(v.Tw / tstep),
        Sx = Math.floor((cv("compactFrac") * cv("ctxWindow") - v.c0) / v.g) + 1, mx, names = ["cost cap", "wall clock", "context window", "policy cap"],
        lims = [Sc, St, Sx, v.S_policy], b = 0, i, r;
      while (costAt(v, Sc + 1) <= v.C) Sc += 1;
      while (Sc > 0 && costAt(v, Sc) > v.C) Sc -= 1;
      lims[0] = Sc;
      mx = Math.max(0, Math.min(lims[0], lims[1], lims[2], lims[3]));
      for (i = 3; i >= 0; i--) if (lims[i] === Math.min(lims[0], lims[1], lims[2], lims[3])) b = i;
      r = { pin_eff: pinEff(v.f), S_cost_raw: raw, S_cost: Sc, t_step: tstep, S_time: St, S_ctx: Sx, max_steps: mx, binding: names[b],
        step_timeout: v.timeout_x * tstep, cost_at_max: costAt(v, mx), ctx_at_max: v.c0 + Math.max(0, mx - 1) * v.g,
        input_at_max: mx * v.c0 + v.g * mx * (mx - 1) / 2 };
      for (i = 0; i < BUD_CURVE.length; i++) r["cost_" + BUD_CURVE[i]] = costAt(v, BUD_CURVE[i]);
      return r;
    },
    notes: function () {
      return ["Cost grows with the square of the step count because every step re-reads the history. Caching changes the slope, not the shape.",
        "Window W is " + cv("ctxWindow") + " tokens (assumption); compaction runs at 80% of it. Prices are list price on " + ASOF + "."];
    }
  };

  /* --------------------------------------------------------------- C-iv ladder */
  function gateModel(v) {
    var g = [], i, p, d, de, esc = 1;
    for (i = 1; i <= NGATE; i++) {
      p = "g" + i + "_";
      d = v[p + "d"];
      de = v[p + "shared"] === "yes" ? d * (1 - v.rho) : d;
      g.push({ i: i, name: v[p + "name"], d: d, de: de, hard: v[p + "hard"] === "hard" });
      esc *= 1 - de;
    }
    return { gates: g, esc: esc };
  }
  function without(gates, j) {
    var e = 1, i;
    for (i = 0; i < gates.length; i++) if (i !== j) e *= 1 - gates[i].de;
    return e;
  }
  var LADDER = {
    id: "ladder", fields: LADDER_FIELDS,
    basis: "assumption — user-set catch rates (no measured per-gate catch rates were found for LLM pipelines [S61]); the structure is the model",
    out: (function () {
      var o = [
        O("P_escape", "Probability a defect escapes every gate", "probability", "P_escape = Π (1 − d_eff,i)", ["rho"]),
        O("coverage", "Coverage", "%", "Coverage = 1 − P_escape (shown as %)", ["rho"]),
        O("ladder", "Ladder (solid = hard gate, dashed = advisory)", "", "Hard gates (cannot be overridden) are drawn as solid rungs; advisory gates as dashed", ["rho"])
      ], i;
      for (i = 1; i <= NGATE; i++) {
        o.push(O("deff_" + i, "Gate " + i + " effective catch rate", "probability", "d_eff,i = dᵢ · (1 − ρ) if the gate shares the generator's model family, else dᵢ", ["rho", "g" + i + "_d", "g" + i + "_shared"]));
        o.push(O("marg_" + i, "Gate " + i + " marginal value", "percentage points", "Marginal value of gate j = P_escape(without j) − P_escape(with j) (shown in percentage points)", ["rho", "g" + i + "_d", "g" + i + "_shared"]));
      }
      return o;
    })(),
    compute: function (v) {
      var m = gateModel(v), r = { P_escape: m.esc, coverage: 100 * (1 - m.esc) }, i, lines = [], gt, mark;
      for (i = 0; i < m.gates.length; i++) {
        gt = m.gates[i];
        r["deff_" + gt.i] = gt.de;
        r["marg_" + gt.i] = 100 * (without(m.gates, i) - m.esc);
        if (gt.d > 0 || gt.name) {
          mark = gt.hard ? "━━" : "┄┄";
          lines.push(mark + " " + (gt.name || "gate " + gt.i) + " (" + (gt.de * 100).toFixed(1) + "%)");
        }
      }
      r.ladder = lines.length ? lines.join("  ") : "no gates";
      return r;
    },
    notes: function () {
      return ["These numbers are what-ifs. The structural lesson holds regardless of the values: an escaped defect has to get past every rung, so add rungs that fail for different reasons.",
        "Catch rates are user assumptions. The factory has run one demo job only [S61]; the factory-shaped preset mirrors its gate order [S60], and its values are not measured."];
    }
  };

  var DEFS = { decide: DECIDE, reliability: RELI, budget: BUD, ladder: LADDER };
  DECIDE.choosers = DECIDE_CHOOSERS; RELI.choosers = []; BUD.choosers = []; LADDER.choosers = LADDER_CHOOSERS;
  DECIDE.title = "Agent or script? Decision scorer";
  RELI.title = "Agent run cost and reliability";
  BUD.title = "Tool-loop budget planner";
  LADDER.title = "Verification-ladder coverage";

  /* ------------------------------------------------------------------- mount */
  var SHOW_ORDER = {
    decide: ["N", "Risk", "Lp", "score", "decision", "flags", "rationale"],
    reliability: ["E", "Ps", "Pu", "Px", "P_run", "retries", "cost_att", "cost_run", "cost_per_success", "p_needed"],
    budget: ["S_cost", "S_time", "S_ctx", "max_steps", "binding", "step_timeout", "cost_at_max", "ctx_at_max", "cost_10", "cost_20", "cost_30", "cost_40", "cost_60"],
    ladder: (function () {
      var o = ["coverage", "P_escape", "ladder"], i;
      for (i = 1; i <= NGATE; i++) o.push("marg_" + i);
      return o;
    })()
  };

  /* v3.24.15 — a reader-facing number: "$1.84" not "1.843 (USD)", "9.11 × 10⁻⁵" not "9.113e-5",
     "0.088" not "0.08800". The raw value still goes to the CSV and to the worked-step line. */
  var SUP = { "-": "\u207B", "0": "\u2070", "1": "\u00B9", "2": "\u00B2", "3": "\u00B3", "4": "\u2074",
    "5": "\u2075", "6": "\u2076", "7": "\u2077", "8": "\u2078", "9": "\u2079" };
  function trimZ(s) { return s.indexOf(".") < 0 ? s : s.replace(/0+$/, "").replace(/\.$/, ""); }
  function sci(x) {
    var e = Math.floor(Math.log(Math.abs(x)) / Math.LN10), m = x / Math.pow(10, e);
    if (Math.abs(m) >= 9.995) { m /= 10; e += 1; }
    return trimZ(m.toFixed(2)) + " \u00D7 10" + String(e).replace(/[-0-9]/g, function (c) { return SUP[c]; });
  }
  function isMoney(u) { return typeof u === "string" && u.indexOf("USD") === 0; }
  function fmt(o) {
    var x = o.value;
    if (typeof x === "boolean") return x ? "yes" : "no";
    if (typeof x === "string") return x;
    if (!isFinite(x)) return "\u2014";
    var a = Math.abs(x);
    if (a === 0) return isMoney(o.unit) ? "$0" : "0";
    if (isMoney(o.unit)) {
      var sgn = x < 0 ? "\u2212$" : "$";
      if (a >= 1000) return sgn + a.toLocaleString("en-US", { maximumFractionDigits: 0 });
      if (a >= 1) return sgn + a.toFixed(2);
      if (a >= 0.01) return sgn + trimZ(a.toFixed(3));
      return sgn + trimZ(a.toPrecision(2));
    }
    if (a >= 1e15 || a < 1e-3) return sci(x);
    if (a >= 1000) return x.toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (a >= 100) return trimZ(x.toFixed(1));
    if (a >= 10) return trimZ(x.toFixed(2));
    return trimZ(x.toPrecision(4));
  }
  /* the label carries the unit only when the value does not: "$" already says USD */
  function unitTag(u) {
    if (!u) return "";
    if (u === "USD") return "";
    if (u.indexOf("USD/") === 0) return " (per " + u.slice(4) + ")";
    return " (" + u + ")";
  }
  function tidy(n) { return parseFloat(n.toPrecision(12)); }

  var STYLE = ".agent-calc-hidden{display:none}.agent-calc-actions{display:flex;flex-wrap:wrap;gap:.5rem;margin:.75rem 0}" +
    ".agent-calc-btn{font:inherit;padding:.4rem .8rem;border-radius:4px;cursor:pointer}" +
    ".agent-calc-work{font-size:.75rem;line-height:1.45;margin-top:.35rem;text-align:left;overflow-wrap:anywhere}" +
    ".agent-calc-basis{display:inline-block;font-size:.72rem;padding:.1rem .5rem;border-radius:4px;margin:.25rem 0}" +
    ".agent-calc-notes{font-size:.8rem;margin:.5rem 0;padding-left:1.1rem}.agent-calc-pick{margin:0 0 .75rem}";

  function inputsText(o) {
    var s = [], k;
    for (k in o) if (o.hasOwnProperty(k)) s.push(k + " = " + o[k]);
    return s.join(", ");
  }
  function defField(def, key) {
    for (var k = 0; k < def.fields.length; k++) if (def.fields[k].key === key) return def.fields[k];
    return null;
  }

  var uid = 0;
  function mountOne(el) {
    var d = typeof document !== "undefined" ? document : null;
    var kind = el.getAttribute("data-agent-calc"), def = DEFS[kind];
    if (!d || !def || el.getAttribute("data-agent-calc-ready")) return;
    el.setAttribute("data-agent-calc-ready", "1");
    uid += 1;
    var pfx = "agentc" + uid + "-";
    var inputs = {}, timer = null, showWork = false, last = null;

    function h(tag, cls, text) {
      var n = d.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    }
    var pick = h("div", "calc-grid agent-calc-pick");
    var grid = h("div", "calc-grid");
    var errBox = h("div", "rz-calc-validation");
    errBox.id = pfx + "errors"; errBox.hidden = true; errBox.setAttribute("role", "alert");
    var basis = h("p", "calc-basis agent-calc-basis");
    var results = h("div", "calc-results");
    var notes = h("ul", "agent-calc-notes");
    var actions = h("div", "agent-calc-actions");
    var elems = {};

    function group(label, explain, control) {
      var g = h("div", "calc-input-group"), l = h("label", "calc-label", label);
      if (explain) l.setAttribute("data-explain", explain);
      if (control.id) l.setAttribute("for", control.id);
      g.appendChild(l); g.appendChild(control);
      return g;
    }
    var k, f, c, s, j;
    for (k = 0; k < def.choosers.length; k++) (function (ch) {
      var sel = h("select", "calc-input");
      sel.id = pfx + "pick-" + ch.id;
      sel.setAttribute("aria-label", ch.label);
      var blank = h("option", "", "Choose…"); blank.value = ""; sel.appendChild(blank);
      for (var q = 0; q < ch.options.length; q++) { var op = h("option", "", ch.options[q].label); op.value = String(q); sel.appendChild(op); }
      sel.onchange = function () {
        if (sel.value === "") return;
        var set = ch.options[Number(sel.value)].set, key, t;
        for (key in set) if (set.hasOwnProperty(key) && set[key] !== undefined && elems[key]) {
          t = defField(def, key);
          elems[key].value = t && !t.type ? String(tidy(set[key])) : String(set[key]);
        }
        sel.value = "";
        schedule();
      };
      pick.appendChild(group(ch.label, null, sel));
    })(def.choosers[k]);

    for (k = 0; k < def.fields.length; k++) {
      f = def.fields[k];
      if (f.type === "enum") {
        c = h("select", "calc-input");
        for (j = 0; j < f.options.length; j++) { s = h("option", "", f.options[j].label); s.value = f.options[j].value; c.appendChild(s); }
        c.value = f.def;
        c.onchange = schedule;
      } else if (f.type === "text") {
        c = h("input", "calc-input");
        c.type = "text"; c.value = f.def; c.maxLength = 40;
        c.oninput = schedule;
      } else {
        c = h("input", "calc-input");
        c.type = "number";
        c.value = String(tidy(f.def));
        c.min = String(tidy(f.min)); c.max = String(tidy(f.max));
        c.step = String(f.step);
        c.oninput = schedule;
      }
      c.id = pfx + f.key;
      c.setAttribute("aria-label", f.label + (f.unit ? " (" + f.unit + ")" : ""));
      elems[f.key] = c;
      grid.appendChild(group(f.label + (f.unit ? " (" + f.unit + ")" : ""), f.explain, c));
    }

    var wbtn = h("button", "agent-calc-btn", "Show working"); wbtn.type = "button";
    wbtn.setAttribute("aria-pressed", "false");
    wbtn.onclick = function () {
      showWork = !showWork;
      wbtn.textContent = showWork ? "Hide working" : "Show working";
      wbtn.setAttribute("aria-pressed", showWork ? "true" : "false");
      toggleWork();
    };
    var cbtn = h("button", "agent-calc-btn", "Copy CSV"); cbtn.type = "button";
    cbtn.onclick = function () { copyCsv(cbtn); };
    actions.appendChild(wbtn);
    if (win.RZCalc) actions.appendChild(cbtn);

    if (def.choosers.length) el.appendChild(pick);
    el.appendChild(grid); el.appendChild(errBox);
    el.appendChild(basis); el.appendChild(results); el.appendChild(notes); el.appendChild(actions);

    function readInputs() {
      var o = {}, key, t;
      for (key in elems) if (elems.hasOwnProperty(key)) {
        t = defField(def, key);
        o[key] = t.type === "enum" || t.type === "text" ? elems[key].value : (elems[key].value.trim() === "" ? NaN : Number(elems[key].value));
      }
      return o;
    }
    function toggleWork() {
      var nodes = results.querySelectorAll(".agent-calc-work"), n;
      for (n = 0; n < nodes.length; n++) nodes[n].className = showWork ? "agent-calc-work" : "agent-calc-work agent-calc-hidden";
    }
    function render() {
      var chk, fieldsList = [], key, r, order, n, m, item, v, lab, w;
      for (key in elems) if (elems.hasOwnProperty(key) && !defField(def, key).type) {
        fieldsList.push({ id: elems[key].id, label: defField(def, key).label });
      }
      chk = win.RZCalc ? win.RZCalc.validateNumbers(fieldsList) : { ok: true, errors: [] };
      inputs = readInputs();
      r = run(def, inputs);
      last = r;
      if (win.RZCalc) win.RZCalc.showErrors(errBox.id, chk.errors);
      else { errBox.hidden = r.valid; errBox.textContent = r.valid ? "" : r.errors.map(function (e) { return e.msg; }).join(" · "); }
      basis.textContent = "Basis: " + r.basis;
      results.innerHTML = "";
      order = SHOW_ORDER[kind];
      for (n = 0; n < order.length; n++) {
        m = r.out[order[n]];
        item = h("div", "calc-result-item");
        v = h("div", "calc-result-value", fmt(m));
        lab = h("div", "calc-result-label", m.label + unitTag(m.unit));
        w = h("div", "agent-calc-work agent-calc-hidden", m.formula + "  |  " + inputsText(m.inputs));
        item.appendChild(v); item.appendChild(lab); item.appendChild(w);
        results.appendChild(item);
      }
      notes.innerHTML = "";
      for (n = 0; n < r.notes.length; n++) notes.appendChild(h("li", "", r.notes[n]));
      toggleWork();
    }
    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(render, 120);
    }
    function csvRows() {
      var rows = [], key, m;
      for (key in last.inputs) if (last.inputs.hasOwnProperty(key)) rows.push(["Input", key, String(last.inputs[key]), "", ""]);
      for (key in last.out) if (last.out.hasOwnProperty(key)) {
        m = last.out[key];
        rows.push(["Output", m.label, typeof m.value === "number" && !isFinite(m.value) ? "" : String(m.value), m.unit, m.formula]);
      }
      return rows;
    }
    function copyCsv(btn) {
      if (!last || !last.valid) return;
      var rows = csvRows(), lines = ["Section,Field,Value,Unit,Note"], n, txtOut;
      for (n = 0; n < rows.length; n++) lines.push(rows[n].map(win.RZCalc.csvEscape).join(","));
      txtOut = lines.join("\n");
      try {
        if (win.navigator && win.navigator.clipboard) {
          win.navigator.clipboard.writeText(txtOut).then(function () { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy CSV"; }, 1500); },
            function () { win.RZCalc.downloadCSV("agent-calc-" + kind + ".csv", ["Section,Field,Value,Unit,Note"], rows); });
          return;
        }
      } catch (e) { /* fall through to download */ }
      win.RZCalc.downloadCSV("agent-calc-" + kind + ".csv", ["Section,Field,Value,Unit,Note"], rows);
    }
    render();
  }

  function mount(rootEl) {
    if (typeof document === "undefined") return 0;
    if (!document.getElementById("agent-calc-css")) {
      var st = document.createElement("style");
      st.id = "agent-calc-css"; st.textContent = STYLE;
      (document.head || document.documentElement).appendChild(st);
    }
    var nodes = (rootEl || document).querySelectorAll("[data-agent-calc]"), n;
    for (n = 0; n < nodes.length; n++) mountOne(nodes[n]);
    return nodes.length;
  }

  win.RZAgentCalc = {
    fmt: fmt,
    unitTag: unitTag,
    constants: constants,
    presets: presets,
    fields: { decide: DECIDE_FIELDS, reliability: REL_FIELDS, budget: BUD_FIELDS, ladder: LADDER_FIELDS },
    decide: function (inp) { return run(DECIDE, inp); },
    reliability: function (inp) { return run(RELI, inp); },
    budget: function (inp) { return run(BUD, inp); },
    ladder: function (inp) { return run(LADDER, inp); },
    mount: mount
  };

  if (typeof document !== "undefined" && !win.__rzAgentCalc) {
    win.__rzAgentCalc = true;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { mount(document); });
    else mount(document);
  }
})(typeof window !== "undefined" ? window : this);
