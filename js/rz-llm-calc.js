/* rz-llm-calc.js — the five calculators of article 29 ("How a Large Language Model Actually Works").
 *
 *   RZLlmCalc.fit(inputs)       C-i   model memory + KV cache + hardware fit
 *   RZLlmCalc.training(inputs)  C-ii  training compute, GPU-hours, cost, energy
 *   RZLlmCalc.serve(inputs)     C-iii inference throughput and $/M tokens (roofline ceiling)
 *   RZLlmCalc.lora(inputs)      C-iv  LoRA / QLoRA fine-tune memory
 *   RZLlmCalc.tokens(inputs)    C-v   tokens per document and API cost
 *   RZLlmCalc.mount(root)       renders every [data-llm-calc] element under root
 *
 * The five compute functions are pure: object in, object out, no DOM. Every output is
 * {value, unit, formula, inputs}. Every constant lives in RZLlmCalc.constants with its
 * source ([Sn] tags resolve in Article/Article_29/RESEARCH.md section 11). Spec:
 * Article/Article_29/CALCULATORS.md. Out-of-range or non-numeric input gives valid:false
 * and NaN outputs (the UI prints a dash); nothing is silently clamped.
 * ES5, zero dependencies; uses window.RZCalc (js/rz-calc-utils.js) for validation + CSV.
 */
(function (root) {
  "use strict";
  var win = root;
  if (win.RZLlmCalc) return;

  var ASOF = "2026-10-16";

  /* ---------------------------------------------------------------- constants */
  var constants = {};
  function K(key, value, unit, source, note) {
    constants[key] = { value: value, unit: unit, source: source, asOf: ASOF, note: note || "" };
  }
  var FD = "FLOP/s dense";
  K("H100.bw", 3.35e12, "B/s", "[S8]");
  K("H100.mem", 80e9, "B", "[S8]");
  K("H100.bf16", 989e12, FD, "[S8]");
  K("H100.fp8", 1979e12, FD, "[S8]");
  K("H200.bw", 4.8e12, "B/s", "[S9]");
  K("H200.mem", 141e9, "B", "[S9]");
  K("H200.bf16", 989e12, FD, "[S9]", "same FLOPs as H100");
  K("H200.fp8", 1979e12, FD, "[S9]", "same FLOPs as H100");
  K("B200.bw", 8e12, "B/s", "[S12]", "64 TB/s per 8-GPU DGX B200 / 8");
  K("B200.mem", 180e9, "B", "[S12]", "1,440 GB per DGX B200 / 8");
  K("B200.fp8", 9e15, FD, "[S12]", "72 PF / 8; sparse or dense basis is not stated in the source, so flag it");
  K("MI355X.bw", 8e12, "B/s", "[S13]");
  K("MI355X.mem", 288e9, "B", "[S13]");
  K("MI355X.bf16", 2.5e15, FD, "[S13]");
  K("MI355X.fp8", 5e15, FD, "[S13]");
  K("MI355X.tbp", 1400, "W", "[S13]");
  K("GB200.gpu_mem", 186e9, "B", "[S10]", "derived: 13.4 TB / 72");
  K("GB200.gpu_bw", 8e12, "B/s", "[S10]", "derived: 576 TB/s / 72");
  K("GB200.bf16", 2.5e15, FD, "[S10]", "derived: 360 PF sparse / 2 / 72");
  K("GB200.rack_mem", 13.4e12, "B", "[S10]", "NVL72 rack, 13.4 TB");
  K("TPUv7.bw", 7.37e12, "B/s", "[S14]");
  K("TPUv7.mem", 192e9, "B", "[S14]");
  K("TPUv7.fp8", 4.614e15, FD, "[S14]");
  K("RTX4090.bw", 1.008e12, "B/s", "[S15b]", "secondary source");
  K("RTX4090.mem", 24e9, "B", "[S15b]", "secondary source");
  K("RTX5090.bw", 1.792e12, "B/s", "[S15]", "derived: 512-bit x 28 Gbps / 8");
  K("RTX5090.mem", 32e9, "B", "[S15]");
  K("RTX5090.tgp", 575, "W", "[S15]");
  K("M4Max.bw", 546e9, "B/s", "[S71]");
  K("M4Max.mem", 128e9, "B", "[S71]");
  K("M3Ultra.bw", 819e9, "B/s", "[S71]");
  K("M3Ultra.mem", 512e9, "B", "[S71]");
  K("kW_per_GPU.H100_node", 1.275, "kW", "[S70]", "DGX H100 10.2 kW / 8");
  K("kW_per_GPU.B200_node", 1.79, "kW", "[S12]", "derived: DGX B200 14.3 kW / 8");
  K("kW_per_GPU.GB200_rack", 1.83, "kW", "[S68]", "derived: 132 kW / 72");
  K("usable.os_share", 0.75, "fraction", "assumption", "share of unified memory usable by the model on Apple silicon; assumption, flagged");
  var BPW = [["BF16", 16], ["FP8", 8], ["INT8", 8], ["Q8_0", 8.5008], ["Q6_K", 6.5633], ["Q5_K_M", 5.7036],
    ["Q4_K_M", 4.8944], ["IQ4_XS", 4.4597], ["Q3_K_M", 3.996], ["Q2_K", 3.1593]];
  var i;
  for (i = 0; i < BPW.length; i++) K("bpw." + BPW[i][0], BPW[i][1], "bits/param", "[S39] [S35]");
  K("bpw.NF4+DQ", 4.127, "bits/param", "[S35]", "NF4 with double quantisation");
  K("flop.train_per_param_token", 6, "FLOP", "[S7]", "C = 6 N D");
  K("flop.fwd_per_param_token", 2, "FLOP", "[S7]", "forward pass 2 N per token");
  K("chinchilla.c_divisor", 120, "", "[S5][S6]", "N_opt = sqrt(C/120) from C = 6 N (20 N)");
  K("chinchilla.tok_per_param", 20, "tokens/param", "[S5][S6]");
  K("train_bytes_per_param", 16, "B/param", "[S60]", "mixed-precision AdamW: 2 + 2 + 12");
  K("lora.full_state_bytes_per_param", 14, "B/param", "[S60]", "gradient 2 + Adam/master 12");
  K("lora.base_bytes_bf16", 2, "B/param", "[S35]");
  K("lora.act_k_ckpt", 2, "", "assumption", "layer inputs only with gradient checkpointing; rough");
  K("lora.act_bytes", 2, "B", "assumption", "BF16 activations");
  K("lora.act_band", 0.5, "fraction", "assumption", "activation uncertainty, plus or minus 50%");
  K("code.chars_per_tok", 2.85, "chars/token", "[S72]", "midpoint of the measured 2.7-3.0");
  K("tok_per_word.en.o200k", 1.2, "tokens/word", "[S72]", "sample of one paragraph");
  K("tok_per_word.en.cl100k", 1.2, "tokens/word", "[S72]", "sample of one paragraph; Qwen3 measured the same class");
  K("tok_per_word.en.deepseek", 1.2, "tokens/word", "[S72]", "sample of one paragraph");
  K("tok_per_word.en.claude", 1e6 / 555000, "tokens/word", "[S27]", "vendor statement: 555k words per 1M tokens");
  K("tok_per_word.id.o200k", 1.6, "tokens/word", "[S72]", "sample of one paragraph");
  K("tok_per_word.id.cl100k", 2.05, "tokens/word", "[S72]", "sample of one paragraph; Qwen3 measured the same class");
  K("tok_per_word.id.deepseek", 1.72, "tokens/word", "[S72]", "sample of one paragraph");
  K("tok.band", 0.15, "fraction", "assumption", "token ratios vary with domain, formatting and numerals");
  K("price.cache_read_mult", 0.05, "x input price", "[S27]", "cache read multiplier for Opus / Sonnet 5.5");
  K("ctx.current", 1e6, "tokens", "[S27][S28][S29]", "current Claude / GPT-6 / Gemini 3.x");
  K("ctx.open", 128000, "tokens", "[S2][S3][S1]", "Llama 3.1 / Qwen3 / DeepSeek-V3");
  K("serve.eff_bw", 0.6, "fraction", "assumption", "achieved fraction of bandwidth");
  K("serve.mfu_prefill", 0.5, "fraction", "assumption", "prefill utilisation");

  function cv(key) { return constants[key].value; }

  /* ----------------------------------------------------------------- presets */
  var presets = { models: {}, hardware: {}, levels: [], prices: [], lora: {}, precision: {}, training: {} };
  function model(name, p) { p.name = name; presets.models[name] = p; }
  model("Llama 3.1 8B", { N_total: 8.03e9, N_active: 8.03e9, layers: 32, kv_heads: 8, d_head: 128, kv_type: "gqa", source: "[S2]" });
  model("Llama 3.1 70B", { N_total: 70.6e9, N_active: 70.6e9, layers: 80, kv_heads: 8, d_head: 128, kv_type: "gqa", source: "[S2]" });
  model("Llama 3.1 405B", { N_total: 405e9, N_active: 405e9, layers: 126, kv_heads: 8, d_head: 128, kv_type: "gqa", source: "[S2]" });
  model("Qwen3-32B", { N_total: 32.8e9, N_active: 32.8e9, layers: 64, kv_heads: 8, d_head: 128, kv_type: "gqa", source: "[S3]", note: "exact parameter count UNVERIFIED; report says 32B" });
  model("Qwen3-235B-A22B", { N_total: 235e9, N_active: 22e9, layers: 94, kv_heads: 4, d_head: 128, kv_type: "gqa", source: "[S3]" });
  model("DeepSeek-V3 / R1", { N_total: 671e9, N_active: 37e9, layers: 61, mla_width: 576, kv_type: "mla", source: "[S1]", note: "MLA: 576 values per layer per token" });
  model("Llama 4 Scout", { N_total: 109e9, N_active: 17e9, kv_type: "none", source: "[S23]", note: "layers UNVERIFIED (not sourced)" });
  model("gpt-oss-120b", { N_total: 117e9, N_active: 5.1e9, kv_type: "none", source: "[S24]", note: "layers UNVERIFIED" });
  model("Kimi K2", { N_total: 1e12, N_active: 32e9, layers: 61, kv_type: "none", source: "[S25]", note: "MLA dims UNVERIFIED" });

  presets.hardware = {
    "H100 (FP8 dense)": { BW: cv("H100.bw"), F: cv("H100.fp8"), gpu_mem: cv("H100.mem"), kW: cv("kW_per_GPU.H100_node"), peak: cv("H100.bf16"), source: "[S8]" },
    "H200 (FP8 dense)": { BW: cv("H200.bw"), F: cv("H200.fp8"), gpu_mem: cv("H200.mem"), kW: cv("kW_per_GPU.H100_node"), peak: cv("H200.bf16"), source: "[S9]" },
    "B200 (FP8, basis unstated)": { BW: cv("B200.bw"), F: cv("B200.fp8"), gpu_mem: cv("B200.mem"), kW: cv("kW_per_GPU.B200_node"), peak: cv("B200.fp8"), source: "[S12]" },
    "MI355X (FP8)": { BW: cv("MI355X.bw"), F: cv("MI355X.fp8"), gpu_mem: cv("MI355X.mem"), peak: cv("MI355X.bf16"), source: "[S13]" },
    "TPU v7 (FP8)": { BW: cv("TPUv7.bw"), F: cv("TPUv7.fp8"), gpu_mem: cv("TPUv7.mem"), peak: cv("TPUv7.fp8"), source: "[S14]" },
    "GB200 per GPU (BF16)": { BW: cv("GB200.gpu_bw"), F: cv("GB200.bf16"), gpu_mem: cv("GB200.gpu_mem"), kW: cv("kW_per_GPU.GB200_rack"), peak: cv("GB200.bf16"), source: "[S10]" }
  };

  function lv(id, label, usable, per, count, dc) {
    presets.levels.push({ id: id, label: label, usable: usable, perGpu: per, count: count, datacenter: dc });
  }
  lv("rtx4090", "RTX 4090 (24 GB)", cv("RTX4090.mem"), cv("RTX4090.mem"), 1, false);
  lv("rtx5090", "RTX 5090 (32 GB)", cv("RTX5090.mem"), cv("RTX5090.mem"), 1, false);
  lv("m4max", "Apple M4 Max (128 GB x 0.75)", cv("M4Max.mem") * cv("usable.os_share"), cv("M4Max.mem"), 1, false);
  lv("m3ultra", "Apple M3 Ultra (512 GB x 0.75)", cv("M3Ultra.mem") * cv("usable.os_share"), cv("M3Ultra.mem"), 1, false);
  lv("h100x1", "1x H100 (80 GB)", cv("H100.mem"), cv("H100.mem"), 1, true);
  lv("h200x1", "1x H200 (141 GB)", cv("H200.mem"), cv("H200.mem"), 1, true);
  lv("h100x8", "8x H100 (640 GB)", 8 * cv("H100.mem"), cv("H100.mem"), 8, true);
  lv("h200x8", "8x H200 (1,128 GB)", 8 * cv("H200.mem"), cv("H200.mem"), 8, true);
  lv("b200x8", "8x B200 (1,440 GB)", 8 * cv("B200.mem"), cv("B200.mem"), 8, true);
  lv("mi355x8", "8x MI355X (2,304 GB)", 8 * cv("MI355X.mem"), cv("MI355X.mem"), 8, true);
  lv("gb200", "GB200 NVL72 (13,400 GB)", cv("GB200.rack_mem"), cv("GB200.gpu_mem"), 72, true);
  presets.levels.sort(function (a, b) { return a.usable - b.usable; });

  function pr(name, inp, out, ctx, src) { presets.prices.push({ name: name, in_price: inp, out_price: out, context: ctx, source: src, asOf: ASOF }); }
  pr("Claude Sonnet 5.5", 2, 10, cv("ctx.current"), "[S27]");
  pr("Claude Opus 5.5", 4, 20, cv("ctx.current"), "[S27]");
  pr("Claude Fable 5.1", 10, 50, cv("ctx.current"), "[S27]");
  pr("Claude Haiku 5.5 (from)", 0.1, 0.5, cv("ctx.current"), "[S27]");
  pr("GPT-6 Astra", 10, 50, cv("ctx.current"), "[S28]");
  pr("GPT-6.1 Sol", 2, 10, cv("ctx.current"), "[S28]");
  pr("GPT-6 Luna", 0.1, 0.5, cv("ctx.current"), "[S28]");
  pr("Gemini 3.1 Pro Preview (<=200K prompt)", 2, 12, cv("ctx.current"), "[S29]");
  pr("Gemini 3.8 Flash (until 2026-12-31)", 0.75, 3.75, cv("ctx.current"), "[S29]");

  presets.lora = {
    "Llama 3.1 8B": { N_base: 8.03e9, layers: 32, d_model: 4096, kv_dim: 1024, d_ff: 14336, source: "[S2]" },
    "Llama 3.1 70B": { N_base: 70.6e9, layers: 80, d_model: 8192, kv_dim: 1024, d_ff: 28672, source: "[S2]", note: "d_ff UNVERIFIED from the research session" }
  };
  presets.precision = {};
  for (i = 0; i < BPW.length; i++) presets.precision[BPW[i][0]] = cv("bpw." + BPW[i][0]);
  presets.precision["NF4+DQ"] = cv("bpw.NF4+DQ");
  presets.training = {
    "Llama 3.1 405B (validation)": { N: 405e9, D: 15.6e12, peak: cv("H100.bf16"), n_gpus: 16384, source: "[S2]" },
    "DeepSeek-V3 active (validation)": { N: 37e9, D: 14.8e12, peak: cv("H100.bf16"), price: 2, source: "[S1]" }
  };

  /* ------------------------------------------------------- field definitions */
  // def/min/max are in canonical (SI) units; scale converts to the displayed unit.
  function F(key, label, unit, scale, def, min, max, step, explain, opts) {
    var f = { key: key, label: label, unit: unit, scale: scale, def: def, min: min, max: max, step: step, explain: explain };
    if (opts) for (var k in opts) f[k] = opts[k];
    return f;
  }
  function E(key, label, def, options, explain) {
    return { key: key, label: label, type: "enum", def: def, options: options, explain: explain };
  }
  function opt(v, l) { return { value: v, label: l }; }
  function chooser(id, label, map) {
    var o = [], n;
    for (n in map) if (map.hasOwnProperty(n)) o.push({ label: n, set: map[n] });
    return { id: id, label: label, options: o };
  }
  var KV_OPTS = [opt("gqa", "GQA / MHA"), opt("mla", "MLA"), opt("none", "Not modelled (weights only)")];

  var TARGET_SETS = {
    all: ["q", "k", "v", "o", "gate", "up", "down"],
    attn: ["q", "k", "v", "o"],
    qv: ["q", "v"],
    mlp: ["gate", "up", "down"]
  };

  var FIT_FIELDS = [
    F("N_total", "Parameters N_total", "B", 1e9, 70.6e9, 1e8, 2e12, "any", "llm-n-total"),
    F("precision", "Weight precision", "bits/param", 1, 8, 2, 32, "any", "llm-weight-bits"),
    E("kv_type", "KV cache type", "gqa", KV_OPTS, "llm-kv-type"),
    F("layers", "Layers", "", 1, 80, 1, 1000, 1, "llm-layers", { int: true }),
    F("kv_heads", "KV heads", "", 1, 8, 1, 1024, 1, "llm-kv-heads", { int: true }),
    F("d_head", "Head dimension", "", 1, 128, 1, 1024, 1, "llm-d-head", { int: true }),
    F("mla_width", "MLA width (MLA only)", "values/layer/token", 1, 576, 1, 65536, 1, "llm-mla-width", { int: true }),
    F("kv_bits", "KV cache precision", "bits", 1, 16, 4, 16, "any", "llm-kv-bits"),
    F("context", "Context per sequence", "tokens", 1, 8192, 1, 1e7, 1, "llm-context"),
    F("batch", "Concurrent sequences", "", 1, 1, 1, 4096, 1, "llm-batch", { int: true }),
    F("overhead", "Runtime overhead (rule of thumb)", "fraction", 1, 0.1, 0, 0.5, 0.01, "llm-overhead")
  ];
  var FIT_CHOOSERS = [
    chooser("model", "Model preset", (function () {
      var m = {}, n, p;
      for (n in presets.models) if (presets.models.hasOwnProperty(n)) {
        p = presets.models[n];
        m[n] = { N_total: p.N_total, kv_type: p.kv_type, layers: p.layers, kv_heads: p.kv_heads, d_head: p.d_head, mla_width: p.mla_width };
      }
      return m;
    })()),
    chooser("precision", "Precision preset", (function () {
      var m = {}, n;
      for (n in presets.precision) if (presets.precision.hasOwnProperty(n)) m[n + " (" + presets.precision[n] + " bits)"] = { precision: presets.precision[n] };
      return m;
    })())
  ];

  var TRAIN_FIELDS = [
    F("N", "Parameters N (active, for MoE)", "B", 1e9, 70e9, 1e8, 2e12, "any", "llm-train-n"),
    F("D", "Training tokens D", "T tokens", 1e12, 15e12, 1e9, 1e14, "any", "llm-train-d"),
    F("peak", "GPU peak (dense, chosen precision)", "TFLOP/s", 1e12, 989e12, 1e13, 1e17, "any", "llm-peak"),
    F("MFU", "Model FLOPs utilisation", "fraction", 1, 0.4, 0.1, 0.6, 0.01, "llm-mfu"),
    F("n_gpus", "GPUs", "", 1, 16384, 1, 1e6, 1, "llm-n-gpus", { int: true }),
    F("price", "Price per GPU-hour", "USD", 1, 2.5, 0.5, 15, 0.1, "llm-gpu-price"),
    F("kW_per_GPU", "All-in IT power per GPU", "kW", 1, 1.275, 0.3, 3, 0.005, "llm-kw-gpu"),
    F("PUE", "PUE", "", 1, 1.2, 1.03, 2, 0.01, "llm-pue"),
    F("goodput", "Goodput (useful share of wall time)", "fraction", 1, 0.9, 0.5, 1, 0.01, "llm-goodput")
  ];
  var TRAIN_CHOOSERS = [
    chooser("gpu", "GPU preset", (function () {
      var m = {}, n;
      for (n in presets.hardware) if (presets.hardware.hasOwnProperty(n)) {
        m[n] = { peak: presets.hardware[n].peak, kW_per_GPU: presets.hardware[n].kW };
      }
      return m;
    })()),
    chooser("validation", "Validation run", presets.training)
  ];

  var SERVE_FIELDS = [
    F("N_total", "Parameters N_total", "B", 1e9, 70.6e9, 1e8, 2e12, "any", "llm-n-total"),
    F("N_active", "Active parameters N_active", "B", 1e9, 70.6e9, 1e8, 2e12, "any", "llm-n-active"),
    F("w_bits", "Weight precision", "bits/param", 1, 8, 2, 16, "any", "llm-weight-bits"),
    F("kv_bits", "KV cache precision", "bits", 1, 16, 4, 16, "any", "llm-kv-bits"),
    E("kv_type", "KV cache type", "gqa", KV_OPTS, "llm-kv-type"),
    F("layers", "Layers", "", 1, 80, 1, 1000, 1, "llm-layers", { int: true }),
    F("kv_heads", "KV heads", "", 1, 8, 1, 1024, 1, "llm-kv-heads", { int: true }),
    F("d_head", "Head dimension", "", 1, 128, 1, 1024, 1, "llm-d-head", { int: true }),
    F("mla_width", "MLA width (MLA only)", "values/layer/token", 1, 576, 1, 65536, 1, "llm-mla-width", { int: true }),
    F("BW", "Memory bandwidth per GPU", "TB/s", 1e12, 4.8e12, 1e11, 5e13, "any", "llm-bandwidth"),
    F("F", "Peak compute per GPU (dense)", "TFLOP/s", 1e12, 1.979e15, 1e13, 5e16, "any", "llm-peak"),
    F("gpu_mem", "Memory per GPU", "GB", 1e9, 141e9, 8e9, 1e12, "any", "llm-gpu-mem"),
    F("n_gpus", "GPUs (tensor parallel, ideal)", "", 1, 1, 1, 72, 1, "llm-n-gpus", { int: true }),
    F("B", "Batch (concurrent sequences)", "", 1, 32, 1, 1024, 1, "llm-batch", { int: true }),
    F("ctx_avg", "Average context in cache", "tokens", 1, 4096, 1, 1e7, 1, "llm-context"),
    F("prompt", "Prompt length for TTFT", "tokens", 1, 4000, 1, 1e7, 1, "llm-prompt"),
    F("eff_bw", "Achieved bandwidth fraction (assumption)", "fraction", 1, 0.6, 0.3, 0.9, 0.01, "llm-eff-bw"),
    F("mfu_prefill", "Prefill utilisation (assumption)", "fraction", 1, 0.5, 0.2, 0.7, 0.01, "llm-mfu-prefill"),
    F("price", "Price per GPU-hour (assumption)", "USD", 1, 3.5, 0.1, 50, 0.1, "llm-gpu-price"),
    F("kW_per_GPU", "All-in IT power per GPU (assumption)", "kW", 1, 1.3, 0.1, 5, 0.01, "llm-kw-gpu")
  ];
  var SERVE_CHOOSERS = [
    FIT_CHOOSERS[0],
    chooser("gpu", "GPU preset", (function () {
      var m = {}, n, h;
      for (n in presets.hardware) if (presets.hardware.hasOwnProperty(n)) {
        h = presets.hardware[n];
        m[n] = { BW: h.BW, F: h.F, gpu_mem: h.gpu_mem };
      }
      return m;
    })())
  ];
  // The model chooser sets N_active too (serve needs it).
  (function () {
    var o = [], n, p;
    for (n in presets.models) if (presets.models.hasOwnProperty(n)) {
      p = presets.models[n];
      o.push({ label: n, set: { N_total: p.N_total, N_active: p.N_active, kv_type: p.kv_type, layers: p.layers, kv_heads: p.kv_heads, d_head: p.d_head, mla_width: p.mla_width } });
    }
    SERVE_CHOOSERS[0] = { id: "model", label: "Model preset", options: o };
  })();

  var LORA_FIELDS = [
    F("N_base", "Base parameters", "B", 1e9, 8.03e9, 1e8, 2e12, "any", "llm-n-total"),
    F("layers", "Layers", "", 1, 32, 1, 1000, 1, "llm-layers", { int: true }),
    F("d_model", "Model width d_model", "", 1, 4096, 16, 65536, 1, "llm-d-model", { int: true }),
    F("kv_dim", "K/V projection width", "", 1, 1024, 16, 65536, 1, "llm-kv-dim", { int: true }),
    F("d_ff", "FFN width d_ff", "", 1, 14336, 16, 262144, 1, "llm-d-ff", { int: true }),
    E("targets", "Adapter targets", "all", [opt("all", "q k v o gate up down"), opt("attn", "q k v o"), opt("qv", "q v"), opt("mlp", "gate up down")], "llm-lora-targets"),
    F("r", "LoRA rank r", "", 1, 16, 1, 256, 1, "llm-lora-rank", { int: true }),
    E("mode", "Mode", "qlora", [opt("full", "Full fine-tune"), opt("lora", "LoRA (BF16 base)"), opt("qlora", "QLoRA (NF4 base)")], "llm-lora-mode"),
    F("seq_len", "Sequence length", "tokens", 1, 2048, 1, 1e6, 1, "llm-seq-len"),
    F("micro_batch", "Micro-batch", "", 1, 1, 1, 256, 1, "llm-micro-batch", { int: true }),
    E("grad_ckpt", "Gradient checkpointing", "on", [opt("on", "On"), opt("off", "Off (activations not modelled)")], "llm-grad-ckpt")
  ];
  var LORA_CHOOSERS = [chooser("model", "Model preset", presets.lora)];

  var TOK_FIELDS = [
    E("language", "Language", "en", [opt("en", "English"), opt("id", "Indonesian"), opt("code", "Code")], "llm-language"),
    E("tokenizer", "Tokenizer family", "claude", [opt("o200k", "o200k class"), opt("cl100k", "cl100k / Qwen class"), opt("deepseek", "DeepSeek class"), opt("claude", "Claude current (English only)")], "llm-tokenizer"),
    F("words", "Words (EN / ID)", "words", 1, 10000, 1, 1e7, 1, "llm-words"),
    F("chars", "Characters (code only)", "chars", 1, 50000, 1, 1e8, 1, "llm-chars"),
    F("in_price", "Input price", "USD / M tokens", 1, 2, 0, 1000, 0.01, "llm-in-price"),
    F("out_price", "Output price", "USD / M tokens", 1, 10, 0, 1000, 0.01, "llm-out-price"),
    F("output_ratio", "Output tokens / input tokens", "ratio", 1, 0.1, 0, 5, 0.01, "llm-output-ratio"),
    F("calls", "Calls", "", 1, 1, 1, 1e9, 1, "llm-calls", { int: true }),
    F("cached_fraction", "Input billed as cache read", "fraction", 1, 0, 0, 1, 0.01, "llm-cached-fraction"),
    F("cache_read_mult", "Cache-read price multiplier", "x input price", 1, 0.05, 0, 1, 0.01, "llm-cache-mult"),
    F("context_limit", "Model context window", "tokens", 1, 1e6, 1000, 1e7, 1, "llm-context-limit")
  ];
  var TOK_CHOOSERS = [chooser("price", "Price preset (list price, 2026-10-16)", (function () {
    var m = {}, k;
    for (k = 0; k < presets.prices.length; k++) {
      m[presets.prices[k].name + " ($" + presets.prices[k].in_price + " / $" + presets.prices[k].out_price + ")"] =
        { in_price: presets.prices[k].in_price, out_price: presets.prices[k].out_price, context_limit: presets.prices[k].context };
    }
    return m;
  })())];

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
      if (f.type === "enum") {
        ok = false;
        for (j = 0; j < f.options.length; j++) if (f.options[j].value === raw) ok = true;
        if (f.key === "targets" && Object.prototype.toString.call(raw) === "[object Array]") {
          ok = raw.length > 0;
          for (j = 0; j < raw.length; j++) if (TARGET_SETS.all.indexOf(raw[j]) < 0) ok = false;
        }
        if (!ok) errors.push({ key: f.key, msg: f.label + " is not a valid choice" });
        v[f.key] = raw;
        continue;
      }
      n = toNum(raw);
      if (!isFinite(n)) errors.push({ key: f.key, msg: f.label + " is required and must be a number" });
      else if (n < f.min || n > f.max) errors.push({ key: f.key, msg: f.label + " must be " + (f.min / f.scale) + " to " + (f.max / f.scale) });
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
    if (valid) { vals = def.compute(r.v); notes = def.notes ? def.notes(r.v) : []; }
    for (k = 0; k < def.out.length; k++) {
      m = def.out[k];
      ins = {};
      for (j = 0; j < m.ins.length; j++) ins[m.ins[j]] = r.v[m.ins[j]];
      out[m.key] = { value: valid ? vals[m.key] : NaN, unit: m.unit, formula: m.formula, inputs: ins, label: m.label };
    }
    return { id: def.id, valid: valid, errors: errors, out: out, basis: def.basis, notes: notes, inputs: r.v };
  }

  function kvTok(v) {
    if (v.kv_type === "gqa") return 2 * v.layers * v.kv_heads * v.d_head * v.kv_bits / 8;
    if (v.kv_type === "mla") return v.layers * v.mla_width * v.kv_bits / 8;
    return 0;
  }
  var KV_NOTE = "KV not modelled — architecture not published in sources";

  /* ------------------------------------------------------------------- C-i */
  var F_W = "W_bytes = N_total × precision / 8";
  var F_KVG = "KV_tok = 2 × layers × kv_heads × d_head × kv_bits/8";
  var F_KVM = "KV_tok = layers × mla_width × kv_bits/8";
  var F_KV = "KV_bytes = KV_tok × context × batch";
  var F_TOT = "Total = (W_bytes + KV_bytes) × (1 + overhead)";
  var F_FIT = "Fit(level) = Total ≤ usable_mem(level)";
  var F_GPUS = "GPUs needed = ceil(Total / per-GPU memory)";
  var FIT_OUT = [
    O("W", "Weights", "GB", F_W, ["N_total", "precision"]),
    O("KV_tok", "KV cache per token", "B/token", F_KVG + "  |  " + F_KVM, ["kv_type", "layers", "kv_heads", "d_head", "mla_width", "kv_bits"]),
    O("KV", "KV cache", "GB", F_KV, ["context", "batch"]),
    O("KV_GiB", "KV cache", "GiB", F_KV + " / 2^30", ["context", "batch"]),
    O("Total", "Total memory needed", "GB", F_TOT, ["overhead"]),
    O("smallest", "Smallest level that fits", "", F_FIT, []),
    O("smallest_dc", "Smallest datacentre level that fits", "", F_FIT, [])
  ];
  (function () {
    var k, L;
    for (k = 0; k < presets.levels.length; k++) {
      L = presets.levels[k];
      FIT_OUT.push(O("fit_" + L.id, L.label, "", F_FIT, []));
      if (L.count > 1) FIT_OUT.push(O("gpus_" + L.id, "GPUs needed on " + L.label, "GPUs", F_GPUS, []));
    }
  })();

  function fitCore(v) {
    var Wb = v.N_total * v.precision / 8;
    var kt = kvTok(v);
    var kvb = kt * v.context * v.batch;
    var total = (Wb + kvb) * (1 + v.overhead);
    var o = { W: Wb / 1e9, KV_tok: kt, KV: kvb / 1e9, KV_GiB: kvb / 1073741824, Total: total / 1e9 };
    var k, L, first = null, firstDc = null;
    for (k = 0; k < presets.levels.length; k++) {
      L = presets.levels[k];
      o["fit_" + L.id] = total <= L.usable;
      if (L.count > 1) o["gpus_" + L.id] = Math.ceil(total / L.perGpu);
      if (total <= L.usable) {
        if (!first) first = L;
        if (!firstDc && L.datacenter) firstDc = L;
      }
    }
    o.smallest = first ? first.label : "none of the listed levels";
    o.smallest_dc = firstDc ? firstDc.label : "none of the listed levels";
    return o;
  }
  var FIT = {
    id: "fit", fields: FIT_FIELDS, out: FIT_OUT, compute: fitCore,
    basis: "estimate — weights exact, KV exact for the stated architecture; overhead is a rule of thumb [S39] [S35]",
    notes: function (v) { return v.kv_type === "none" ? [KV_NOTE] : []; }
  };

  /* ------------------------------------------------------------------ C-ii */
  var TRAIN = {
    id: "training", fields: TRAIN_FIELDS,
    basis: "estimate — C = 6ND omits attention FLOPs [S7]; price and power are user assumptions",
    out: [
      O("C", "Training compute", "FLOP", "C = 6 × N × D", ["N", "D"]),
      O("rate", "Sustained rate per GPU", "FLOP/s", "rate = peak × MFU", ["peak", "MFU"]),
      O("gpu_hours", "GPU-hours", "GPU-h", "GPU_hours = C / rate / 3600", ["N", "D", "peak", "MFU"]),
      O("wall_days", "Wall-clock time", "days", "wall_days = GPU_hours / n_gpus / goodput / 24", ["n_gpus", "goodput"]),
      O("cost", "Compute cost", "USD", "cost_$ = GPU_hours / goodput × price", ["price", "goodput"]),
      O("E_IT", "IT energy", "MWh", "E_IT_MWh = GPU_hours / goodput × kW_per_GPU / 1000", ["kW_per_GPU", "goodput"]),
      O("E_fac", "Facility energy", "MWh", "E_fac_MWh = E_IT_MWh × PUE", ["PUE"]),
      O("avg_MW", "Average facility power", "MW", "avg_MW = n_gpus × kW_per_GPU × PUE / 1000", ["n_gpus", "kW_per_GPU", "PUE"]),
      O("N_opt", "Compute-optimal parameters", "params", "N_opt = sqrt(C/120)", []),
      O("D_opt", "Compute-optimal tokens", "tokens", "D_opt = 20·N_opt", []),
      O("tok_per_param", "Chosen tokens per parameter", "tokens/param", "D / N", ["N", "D"])
    ],
    compute: function (v) {
      var C = cv("flop.train_per_param_token") * v.N * v.D;
      var rate = v.peak * v.MFU;
      var gh = C / rate / 3600;
      var eit = gh / v.goodput * v.kW_per_GPU / 1000;
      var nopt = Math.sqrt(C / cv("chinchilla.c_divisor"));
      return {
        C: C, rate: rate, gpu_hours: gh,
        wall_days: gh / v.n_gpus / v.goodput / 24,
        cost: gh / v.goodput * v.price,
        E_IT: eit, E_fac: eit * v.PUE,
        avg_MW: v.n_gpus * v.kW_per_GPU * v.PUE / 1000,
        N_opt: nopt, D_opt: cv("chinchilla.tok_per_param") * nopt,
        tok_per_param: v.D / v.N
      };
    }
  };

  /* ----------------------------------------------------------------- C-iii */
  var SERVE = {
    id: "serve", fields: SERVE_FIELDS,
    basis: "ceiling-based estimate, not a benchmark — roofline, ideal tensor-parallel, no communication model",
    cross: function (v) {
      return v.N_active > v.N_total ? [{ key: "N_active", msg: "Active parameters cannot exceed total parameters" }] : [];
    },
    notes: function (v) {
      var n = [], c = serveCore(v);
      if (v.kv_type === "none") n.push(KV_NOTE);
      if (!c.fits) n.push("does not fit: " + (c.Mem_raw / 1e9).toFixed(1) + " GB needed, " + (v.n_gpus * v.gpu_mem / 1e9).toFixed(0) + " GB available");
      if (v.N_active < v.N_total) n.push("MoE: weights read per step use the expected share of experts touched at this batch (assumption, uniform routing)");
      return n;
    },
    out: [
      O("W", "Weights read per step", "GB", "W = N_total_bytes × (1 − (1 − N_active/N_total)^B)  (dense: N × w_bits/8)", ["N_total", "N_active", "w_bits", "B"]),
      O("KV_seq", "KV cache per sequence", "GB", "KV_seq = KV_tok × ctx_avg", ["ctx_avg"]),
      O("Mem", "Memory used", "GB", "Mem = N_total × w_bits/8 + B × KV_seq", ["B"]),
      O("fits", "Fits in GPU memory", "", "Mem ≤ n_gpus × gpu_mem", ["n_gpus", "gpu_mem"]),
      O("t_mem", "Memory time per step", "ms", "t_mem = (W + B × KV_seq) / (n_gpus × BW)", ["BW", "n_gpus"]),
      O("t_comp", "Compute time per step", "ms", "t_comp = 2 × N_active × B / (n_gpus × F)", ["F", "n_gpus"]),
      O("bound", "Decode regime", "", "compute-bound when intensity > ridge", []),
      O("t_step", "Step time (TPOT)", "ms", "t_step = max(t_mem, t_comp) / eff_bw", ["eff_bw"]),
      O("user_tps", "Per-user speed", "tok/s", "per-user tok/s = 1 / t_step", []),
      O("throughput", "Throughput per replica", "tok/s", "throughput = B / t_step", ["B"]),
      O("cost_mtok", "Cost per million tokens", "USD/Mtok", "$/Mtok = (n_gpus × price) / (throughput × 3600) × 1e6", ["n_gpus", "price"]),
      O("j_tok", "Energy per token", "J/token", "J/token = n_gpus × kW_per_GPU × 1000 / throughput", ["n_gpus", "kW_per_GPU"]),
      O("ttft", "Time to first token", "s", "TTFT ≈ 2 × N_active × prompt / (n_gpus × F × mfu_prefill)", ["prompt", "mfu_prefill"]),
      O("ceiling_b1", "Batch-1 ceiling (eff 1.0)", "tok/s", "n_gpus × BW / W_bytes at B = 1", []),
      O("ridge", "Ridge point", "FLOP/byte", "Ridge = F / BW", ["F", "BW"]),
      O("intensity", "Decode intensity", "FLOP/byte", "decode intensity ≈ 2B/(w_bits/8)", ["B", "w_bits"])
    ],
    compute: function (v) { return serveCore(v); }
  };
  function moeWeights(v, B) {
    // Expected share of experts touched by B tokens, uniform routing (assumption). Dense: share = 1.
    var touched = 1 - Math.pow(1 - v.N_active / v.N_total, B);
    return v.N_total * v.w_bits / 8 * touched;
  }
  function serveCore(v) {
    var kvSeq = kvTok(v) * v.ctx_avg;
    var Wb = moeWeights(v, v.B);
    var mem = v.N_total * v.w_bits / 8 + v.B * kvSeq;
    var fits = mem <= v.n_gpus * v.gpu_mem;
    var agg = v.n_gpus * v.BW;
    var tMem = (Wb + v.B * kvSeq) / agg;
    var tComp = cv("flop.fwd_per_param_token") * v.N_active * v.B / (v.n_gpus * v.F);
    var tStep = Math.max(tMem, tComp) / v.eff_bw;
    var tput = v.B / tStep;
    var ridge = v.F / v.BW;
    var inten = cv("flop.fwd_per_param_token") * v.B / (v.w_bits / 8);
    var o = {
      W: Wb / 1e9, KV_seq: kvSeq / 1e9, Mem: mem / 1e9, Mem_raw: mem, fits: fits,
      t_mem: tMem * 1e3, t_comp: tComp * 1e3,
      bound: inten > ridge ? "compute-bound" : "memory-bound",
      t_step: tStep * 1e3, user_tps: 1 / tStep, throughput: tput,
      cost_mtok: (v.n_gpus * v.price) / (tput * 3600) * 1e6,
      j_tok: v.n_gpus * v.kW_per_GPU * 1000 / tput,
      ttft: cv("flop.fwd_per_param_token") * v.N_active * v.prompt / (v.n_gpus * v.F * v.mfu_prefill),
      ceiling_b1: agg / moeWeights(v, 1),
      ridge: ridge, intensity: inten
    };
    if (!fits) {
      o.t_step = o.user_tps = o.throughput = o.cost_mtok = o.j_tok = NaN;
    }
    return o;
  }
  /* ------------------------------------------------------------------ C-iv */
  function loraDims(v) {
    var d = v.d_model, kv = v.kv_dim, ff = v.d_ff;
    return { q: [d, d], k: [d, kv], v: [d, kv], o: [d, d], gate: [d, ff], up: [d, ff], down: [ff, d] };
  }
  function targetList(t) { return typeof t === "string" ? TARGET_SETS[t] : t; }
  var LORA = {
    id: "lora", fields: LORA_FIELDS,
    basis: "estimate — AdamW FP32 state; activations are a rough term (plus or minus 50%, assumption) [S34] [S35] [S60]",
    notes: function (v) { return v.grad_ckpt === "off" ? ["activations not modelled without gradient checkpointing"] : []; },
    out: [
      O("P_lora", "Adapter parameters", "params", "P_lora = layers × Σ_targets r × (d_in + d_out)", ["layers", "r", "targets"]),
      O("base", "Base weights", "GB", "Base mem = N_base × {Full: 2, LoRA: 2, QLoRA: 4.127/8} bytes", ["N_base", "mode"]),
      O("state", "Train state", "GB", "Train-state mem = {Full: N_base × 14 (grad 2 + Adam/master 12); LoRA/QLoRA: P_lora × 16}", ["mode"]),
      O("act", "Activations (rough)", "GB", "Activations ≈ layers × seq_len × micro_batch × d_model × k_act × 2 B", ["seq_len", "micro_batch", "grad_ckpt"]),
      O("act_low", "Activations, low", "GB", "Activations × (1 − 0.5)", []),
      O("act_high", "Activations, high", "GB", "Activations × (1 + 0.5)", []),
      O("total", "Total memory", "GB", "Total = Base + Train-state + Activations", []),
      O("total_low", "Total, low", "GB", "Base + Train-state + Activations × (1 − 0.5)", []),
      O("total_high", "Total, high", "GB", "Base + Train-state + Activations × (1 + 0.5)", []),
      O("fraction", "Adapter share of base", "fraction", "P_lora / N_base", ["N_base"]),
      O("smallest", "Smallest level that fits", "", "Fit(level) = Total ≤ usable_mem(level)", [])
    ],
    compute: function (v) {
      var dims = loraDims(v), t = targetList(v.targets), s = 0, k;
      for (k = 0; k < t.length; k++) s += v.r * (dims[t[k]][0] + dims[t[k]][1]);
      var P = v.layers * s;
      var baseBytes = v.mode === "qlora" ? cv("bpw.NF4+DQ") / 8 : cv("lora.base_bytes_bf16");
      var base = v.N_base * baseBytes;
      var state = v.mode === "full" ? v.N_base * cv("lora.full_state_bytes_per_param") : P * cv("train_bytes_per_param");
      var act = v.grad_ckpt === "on"
        ? v.layers * v.seq_len * v.micro_batch * v.d_model * cv("lora.act_k_ckpt") * cv("lora.act_bytes") : NaN;
      var band = cv("lora.act_band");
      var total = base + state + act;
      var smallest = "activations not modelled", L, j;
      if (isFinite(total)) {
        smallest = "none of the listed levels";
        for (j = 0; j < presets.levels.length; j++) {
          L = presets.levels[j];
          if (total <= L.usable) { smallest = L.label; break; }
        }
      }
      return {
        P_lora: P, base: base / 1e9, state: state / 1e9, act: act / 1e9,
        act_low: act * (1 - band) / 1e9, act_high: act * (1 + band) / 1e9,
        total: total / 1e9, total_low: (base + state + act * (1 - band)) / 1e9,
        total_high: (base + state + act * (1 + band)) / 1e9,
        fraction: P / v.N_base, smallest: smallest
      };
    }
  };

  /* ------------------------------------------------------------------- C-v */
  var TOKS = {
    id: "tokens", fields: TOK_FIELDS,
    basis: "estimate — token ratios from a sample of one paragraph, plus or minus 15% (assumption); list prices as of " + ASOF + " [S27] [S28] [S29] [S72]",
    cross: function (v) {
      if (v.language !== "code" && !constants["tok_per_word." + v.language + "." + v.tokenizer]) {
        return [{ key: "tokenizer", msg: "No measured ratio for this language and tokenizer" }];
      }
      return [];
    },
    notes: function (v) {
      var n = ["token counts carry about plus or minus 15% (assumption); ratios are a sample of one paragraph"];
      if (v.language === "code") n.push("code uses characters / chars-per-token, not words");
      return n;
    },
    out: [
      O("tokens_in", "Input tokens", "tokens", "tokens_in = words × tok_per_word[language][tokenizer]  (code: chars / chars_per_tok)", ["language", "tokenizer", "words", "chars"]),
      O("tokens_out", "Output tokens", "tokens", "tokens_out = tokens_in × output_ratio", ["output_ratio"]),
      O("cost_in", "Input cost per call", "USD", "tokens_in × [(1−cached)×in_price + cached×in_price×cache_read_mult]/1e6", ["in_price", "cached_fraction", "cache_read_mult"]),
      O("cost_out", "Output cost per call", "USD", "tokens_out × out_price/1e6", ["out_price"]),
      O("cost_call", "Cost per call", "USD", "cost/call = input cost + output cost", []),
      O("total", "Total cost", "USD", "total = cost/call × calls", ["calls"]),
      O("within_context", "Fits the context window", "", "tokens_in ≤ model context", ["context_limit"])
    ],
    compute: function (v) {
      var tin = v.language === "code" ? v.chars / cv("code.chars_per_tok")
        : v.words * cv("tok_per_word." + v.language + "." + v.tokenizer);
      var tout = tin * v.output_ratio;
      var cin = tin * ((1 - v.cached_fraction) * v.in_price + v.cached_fraction * v.in_price * v.cache_read_mult) / 1e6;
      var cout = tout * v.out_price / 1e6;
      return { tokens_in: tin, tokens_out: tout, cost_in: cin, cost_out: cout, cost_call: cin + cout,
        total: (cin + cout) * v.calls, within_context: tin <= v.context_limit };
    }
  };

  var DEFS = { fit: FIT, training: TRAIN, serve: SERVE, lora: LORA, tokens: TOKS };
  FIT.choosers = FIT_CHOOSERS; TRAIN.choosers = TRAIN_CHOOSERS; SERVE.choosers = SERVE_CHOOSERS;
  LORA.choosers = LORA_CHOOSERS; TOKS.choosers = TOK_CHOOSERS;
  FIT.title = "Model memory and hardware fit";
  TRAIN.title = "Training compute, cost and energy";
  SERVE.title = "Inference throughput and cost per million tokens";
  LORA.title = "LoRA / QLoRA fine-tune memory";
  TOKS.title = "Tokens per document and cost";

  /* ------------------------------------------------------------------- mount */
  var SHOW_ORDER = {
    fit: ["W", "KV_tok", "KV", "Total", "smallest", "smallest_dc"],
    training: ["C", "gpu_hours", "wall_days", "cost", "E_IT", "E_fac", "avg_MW", "N_opt", "D_opt", "tok_per_param"],
    serve: ["fits", "W", "KV_seq", "Mem", "t_mem", "t_comp", "bound", "t_step", "user_tps", "throughput", "cost_mtok", "j_tok", "ttft", "ceiling_b1"],
    lora: ["P_lora", "base", "state", "act", "total", "total_low", "total_high", "smallest"],
    tokens: ["tokens_in", "tokens_out", "cost_call", "total", "within_context"]
  };

  function fmt(o) {
    var x = o.value;
    if (typeof x === "boolean") return x ? "yes" : "no";
    if (typeof x === "string") return x;
    if (!isFinite(x)) return "—";
    var a = Math.abs(x);
    if (a === 0) return "0";
    if (a >= 1e15 || a < 1e-3) return x.toExponential(3);
    if (a >= 1000) return x.toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (a >= 100) return x.toFixed(1);
    if (a >= 10) return x.toFixed(2);
    return x.toPrecision(4);
  }
  function tidy(n) { return parseFloat(n.toPrecision(12)); }

  var STYLE = ".llm-calc-hidden{display:none}.llm-calc-actions{display:flex;flex-wrap:wrap;gap:.5rem;margin:.75rem 0}" +
    ".llm-calc-btn{font:inherit;padding:.4rem .8rem;border:1px solid currentColor;background:transparent;color:inherit;border-radius:4px;cursor:pointer}" +
    ".llm-calc-work{font-size:.75rem;line-height:1.45;margin-top:.35rem;text-align:left;overflow-wrap:anywhere}" +
    ".llm-calc-basis{display:inline-block;font-size:.72rem;padding:.1rem .5rem;border:1px solid currentColor;border-radius:999px;opacity:.8;margin:.25rem 0}" +
    ".llm-calc-notes{font-size:.8rem;margin:.5rem 0;padding-left:1.1rem}.llm-calc-pick{margin:0 0 .75rem}";

  var uid = 0;
  function mountOne(el) {
    var d = typeof document !== "undefined" ? document : null;
    var kind = el.getAttribute("data-llm-calc"), def = DEFS[kind];
    if (!d || !def || el.getAttribute("data-llm-calc-ready")) return;
    el.setAttribute("data-llm-calc-ready", "1");
    uid += 1;
    var pfx = "llmc" + uid + "-";
    var inputs = {}, timer = null, showWork = false, last = null;

    function h(tag, cls, text) {
      var n = d.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    }
    var pick = h("div", "calc-grid llm-calc-pick");
    var grid = h("div", "calc-grid");
    var errBox = h("div", "rz-calc-validation");
    errBox.id = pfx + "errors"; errBox.hidden = true; errBox.setAttribute("role", "alert");
    var basis = h("p", "llm-calc-basis");
    var results = h("div", "calc-results");
    var notes = h("ul", "llm-calc-notes");
    var actions = h("div", "llm-calc-actions");
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
          t = DEFS_FIELD(def, key);
          elems[key].value = t && t.type !== "enum" ? String(tidy(set[key] / t.scale)) : String(set[key]);
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
      } else {
        c = h("input", "calc-input");
        c.type = "number";
        c.value = String(tidy(f.def / f.scale));
        c.min = String(tidy(f.min / f.scale)); c.max = String(tidy(f.max / f.scale));
        c.step = String(f.step);
        c.oninput = schedule;
      }
      c.id = pfx + f.key;
      c.setAttribute("aria-label", f.label + (f.unit ? " (" + f.unit + ")" : ""));
      elems[f.key] = c;
      grid.appendChild(group(f.label + (f.unit ? " (" + f.unit + ")" : ""), f.explain, c));
    }

    var wbtn = h("button", "llm-calc-btn", "Show working"); wbtn.type = "button";
    wbtn.setAttribute("aria-pressed", "false");
    wbtn.onclick = function () {
      showWork = !showWork;
      wbtn.textContent = showWork ? "Hide working" : "Show working";
      wbtn.setAttribute("aria-pressed", showWork ? "true" : "false");
      toggleWork();
    };
    var cbtn = h("button", "llm-calc-btn", "Copy CSV"); cbtn.type = "button";
    cbtn.onclick = function () { copyCsv(cbtn); };
    actions.appendChild(wbtn);
    if (win.RZCalc) actions.appendChild(cbtn);

    el.appendChild(pick); el.appendChild(grid); el.appendChild(errBox);
    el.appendChild(basis); el.appendChild(results); el.appendChild(notes); el.appendChild(actions);

    function readInputs() {
      var o = {}, key, t;
      for (key in elems) if (elems.hasOwnProperty(key)) {
        t = DEFS_FIELD(def, key);
        o[key] = t.type === "enum" ? elems[key].value : (elems[key].value.trim() === "" ? NaN : Number(elems[key].value) * t.scale);
      }
      return o;
    }
    function toggleWork() {
      var nodes = results.querySelectorAll(".llm-calc-work"), n;
      for (n = 0; n < nodes.length; n++) nodes[n].className = showWork ? "llm-calc-work" : "llm-calc-work llm-calc-hidden";
    }
    function render() {
      var chk, fieldsList = [], key, r, order, n, m, item, v, lab, w, ul;
      for (key in elems) if (elems.hasOwnProperty(key) && DEFS_FIELD(def, key).type !== "enum") {
        fieldsList.push({ id: elems[key].id, label: DEFS_FIELD(def, key).label });
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
      if (kind === "fit") {
        for (n = 0; n < presets.levels.length; n++) order = order.concat(["fit_" + presets.levels[n].id]);
      }
      for (n = 0; n < order.length; n++) {
        m = r.out[order[n]];
        item = h("div", "calc-result-item");
        v = h("div", "calc-result-value", fmt(m));
        lab = h("div", "calc-result-label", m.label + (m.unit ? " (" + m.unit + ")" : ""));
        w = h("div", "llm-calc-work llm-calc-hidden", m.formula + "  |  " + inputsText(m.inputs));
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
      var rows = csvRows(), lines = ["Section,Field,Value,Unit,Note"], n, txt;
      for (n = 0; n < rows.length; n++) lines.push(rows[n].map(win.RZCalc.csvEscape).join(","));
      txt = lines.join("\n");
      try {
        if (win.navigator && win.navigator.clipboard) {
          win.navigator.clipboard.writeText(txt).then(function () { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy CSV"; }, 1500); },
            function () { win.RZCalc.downloadCSV("llm-calc-" + kind + ".csv", ["Section,Field,Value,Unit,Note"], rows); });
          return;
        }
      } catch (e) { /* fall through to download */ }
      win.RZCalc.downloadCSV("llm-calc-" + kind + ".csv", ["Section,Field,Value,Unit,Note"], rows);
    }
    render();
  }
  function inputsText(o) {
    var s = [], k;
    for (k in o) if (o.hasOwnProperty(k)) s.push(k + " = " + o[k]);
    return s.join(", ");
  }
  function DEFS_FIELD(def, key) {
    for (var k = 0; k < def.fields.length; k++) if (def.fields[k].key === key) return def.fields[k];
    return null;
  }

  function mount(rootEl) {
    if (typeof document === "undefined") return 0;
    if (!document.getElementById("llm-calc-css")) {
      var st = document.createElement("style");
      st.id = "llm-calc-css"; st.textContent = STYLE;
      (document.head || document.documentElement).appendChild(st);
    }
    var nodes = (rootEl || document).querySelectorAll("[data-llm-calc]"), n;
    for (n = 0; n < nodes.length; n++) mountOne(nodes[n]);
    return nodes.length;
  }

  win.RZLlmCalc = {
    constants: constants,
    presets: presets,
    fields: { fit: FIT_FIELDS, training: TRAIN_FIELDS, serve: SERVE_FIELDS, lora: LORA_FIELDS, tokens: TOK_FIELDS },
    fit: function (inp) { return run(FIT, inp); },
    training: function (inp) { return run(TRAIN, inp); },
    serve: function (inp) { return run(SERVE, inp); },
    lora: function (inp) { return run(LORA, inp); },
    tokens: function (inp) { return run(TOKS, inp); },
    mount: mount
  };

  if (typeof document !== "undefined" && !win.__rzLlmCalc) {
    win.__rzLlmCalc = true;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { mount(document); });
    else mount(document);
  }
})(typeof window !== "undefined" ? window : this);
