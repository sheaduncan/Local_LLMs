// Recommendation wizard: deterministic rule engine derived from the course.
// Every output field carries a whyRef pointing to the lesson that explains it.

window.WIZARD = {
  questions: [
    {
      id: "hardware",
      title: "What's your hardware?",
      help: "Both capacity (what fits) AND bandwidth (how fast it runs) matter. Pick the closest match.",
      options: [
        { id: "cpu",       label: "CPU only or thin-and-light laptop (~135–230 GB/s, <12 GB usable)" },
        { id: "midGpu",    label: "Consumer GPU 8–16 GB (RTX 4070-class / 3060–3070 / Arc B60, ~500 GB/s)" },
        { id: "ent24",     label: "Enthusiast GPU 24 GB (RTX 3090 / 4090, ~1 TB/s)" },
        { id: "blackwell", label: "Pro workstation GPU 32–96 GB (RTX 5090 / PRO 6000 Blackwell, ~1.8 TB/s)" },
        { id: "unifMid",   label: "Unified memory ~250–300 GB/s (DGX Spark, Strix Halo, Mac M4/M5 Pro, up to 128 GB)" },
        { id: "appleHigh", label: "Apple Mac Studio Max/Ultra (~460–820 GB/s, 64–512 GB unified)" }
      ]
    },
    {
      id: "useCase",
      title: "Primary use case?",
      help: "Pick the one that best matches what you'll spend most time on.",
      options: [
        { id: "chat",      label: "General chat / assistant" },
        { id: "coding",    label: "Coding assistant" },
        { id: "documents", label: "Private documents / RAG" },
        { id: "reasoning", label: "Reasoning-heavy tasks (math, multi-step)" },
        { id: "agents",    label: "Agents / tool use" },
        { id: "edge",      label: "Edge / low-resource device" }
      ]
    },
    {
      id: "context",
      title: "How much context do you actually need?",
      help: "Be realistic — long context is expensive in memory and time.",
      options: [
        { id: "short",  label: "Short — up to ~8K tokens" },
        { id: "medium", label: "Medium — up to ~32K tokens" },
        { id: "long",   label: "Long — 128K+ tokens" }
      ]
    },
    {
      id: "priority",
      title: "What matters most?",
      options: [
        { id: "quality", label: "Quality" },
        { id: "speed",   label: "Speed / responsiveness" },
        { id: "privacy", label: "Privacy / offline" },
        { id: "cost",    label: "Cost / fitting more in less VRAM" }
      ]
    },
    {
      id: "commercial",
      title: "Commercial use?",
      help: "Will the model be used in a product or for paid work?",
      options: [
        { id: "no",  label: "No — personal or research" },
        { id: "yes", label: "Yes — commercial product or paid work" }
      ]
    }
  ],

  recommend(inputs) {
    const { hardware, useCase, context, priority, commercial } = inputs;

    const fields = [];
    const warnings = [];
    const tips = [];

    // ---- 1. Model size from hardware × use case ----
    // Each hardware tier carries both capacity and bandwidth class.
    // bandwidth: "high" = ~1+ TB/s (discrete dGPU), "mid" = ~450–820 GB/s
    //           "low" = ~250–300 GB/s unified, "very low" = <230 GB/s thin
    const hwTier = {
      cpu:       { size: "0.5B–3B",                          label: "thin-and-light",          bandwidth: "very low", capacity: "small" },
      midGpu:    { size: "4B–9B",                            label: "consumer GPU",            bandwidth: "mid",      capacity: "small" },
      ent24:     { size: "7B–14B",                           label: "enthusiast 24 GB",        bandwidth: "high",     capacity: "medium" },
      blackwell: { size: "14B–32B (70B Q4 if 96 GB)",        label: "Blackwell workstation",   bandwidth: "very high",capacity: "large" },
      unifMid:   { size: "7B–32B (slower decode than dGPU)", label: "unified-memory appliance",bandwidth: "low",      capacity: "very large" },
      appleHigh: { size: "13B–70B (or large MoE on Ultra)",  label: "Apple Max/Ultra",         bandwidth: "mid-high", capacity: "huge" }
    }[hardware];

    let modelSize = hwTier.size;
    let modelSizeWhy = `Your ${hwTier.label} tier — capacity ${hwTier.capacity}, bandwidth ${hwTier.bandwidth} — sets both what fits and how fast it decodes.`;

    if (useCase === "coding") {
      if (hardware === "ent24")          { modelSize = "14B (or 27B/32B with care)"; modelSizeWhy = "24 GB and ~1 TB/s — coding loops want fast tokens on a code-capable instruct model. Stay <32B unless you accept slower iteration."; }
      else if (hardware === "blackwell") { modelSize = "27B–32B code-capable (or 70B Q4 on 96 GB)"; modelSizeWhy = "Blackwell's 1.8 TB/s makes larger code models still feel fast — the right pick for serious local coding."; }
      else if (hardware === "appleHigh") { modelSize = "14B–32B code-capable"; modelSizeWhy = "Apple Max/Ultra has the memory for it, but at lower bandwidth than discrete GPUs — expect slower per-edit latency than a 4090/5090."; }
      else if (hardware === "unifMid")   { modelSize = "7B–14B code-capable"; modelSizeWhy = "Unified memory at ~270 GB/s decodes slowly relative to a real dGPU — coding loops will feel sluggish at larger sizes."; }
    } else if (useCase === "edge") {
      modelSize = "0.5B–4B";
      modelSizeWhy = "Edge devices need a small reliable model — large fragile ones fail in the field.";
    } else if (useCase === "reasoning" && (hardware === "blackwell" || hardware === "appleHigh")) {
      modelSize = "32B+ reasoning-tuned (or MoE)";
      modelSizeWhy = "Reasoning workloads spend extra thinking tokens — a stronger model pays off when capacity allows. Discrete Blackwell will decode faster than Apple at the same size.";
    }

    fields.push({ label: "Model size", value: modelSize, why: modelSizeWhy, whyRef: "m6l1" });

    // ---- 2. Model type / family ----
    let modelType, modelTypeWhy;
    if (useCase === "coding") {
      modelType = "Code-capable instruct (e.g., Qwen3-Coder-Next or Qwen3.6-27B)";
      modelTypeWhy = "Pair a code-capable instruct model with repo retrieval, test execution, and a patch loop.";
    } else if (useCase === "reasoning") {
      modelType = "Reasoning-tuned (thinking-mode) model";
      modelTypeWhy = "Reasoning models benefit from extra thinking tokens and explicit verification.";
    } else if (useCase === "agents") {
      modelType = "Tool-tuned instruct (strong JSON/tool-call adherence)";
      modelTypeWhy = "Agent reliability depends on the model's structured-output and tool-call training.";
    } else if (useCase === "documents") {
      modelType = "Instruct / chat + local embedding + reranker (RAG stack)";
      modelTypeWhy = "For private documents, retrieval and reranking matter as much as the LLM.";
    } else if (useCase === "edge") {
      modelType = "Small instruct model (fixed schemas, tool-assisted)";
      modelTypeWhy = "Constrain edge models with tight schemas and tools — they shine on bounded tasks.";
    } else {
      modelType = "Recent instruct / chat-tuned model";
      modelTypeWhy = "Instruct models are the default starting point — base models complete text, they don't answer it.";
    }
    fields.push({ label: "Model type", value: modelType, why: modelTypeWhy, whyRef: "m2l3" });

    // Family suggestion
    let family;
    if (commercial === "yes") {
      family = "Gemma 4 (Apache 2.0) for permissive commercial use; Qwen 3.5/3.6 if its license fits your deployment.";
    } else if (useCase === "coding") {
      family = "Qwen3-Coder-Next or Qwen3.6-27B is a strong default; GLM and DeepSeek are worth comparing for long-horizon coding.";
    } else if (useCase === "agents") {
      family = "Qwen 3.5/3.6 for general agents; Kimi/Moonshot and Nemotron 3 for production-grade agent stacks.";
    } else if (useCase === "edge") {
      family = "Gemma 4 E2B / E4B or small Qwen 3.5 variants.";
    } else {
      family = "Qwen 3.5/3.6 is a strong default family; Gemma 4 is the alternative if you want Apache 2.0.";
    }
    fields.push({ label: "Model family", value: family, why: "Open-weight is an ecosystem choice: weights, license, tokenizer, template, runtime support, community tools.", whyRef: "m6l3" });

    // ---- 3. Quantization ----
    let quant, quantWhy;
    if (priority === "quality") {
      quant = (hardware === "blackwell" || hardware === "appleHigh") ? "Q6 or Q8 (BF16 baseline if memory allows)" : "Q5 or Q6";
      quantWhy = "Higher precision preserves more behavior. Use FP16/BF16 only when memory is abundant; Q5/Q6 is a strong middle ground.";
    } else if (priority === "cost") {
      quant = "Q4 (Q3 only if you must fit a bigger model — expect quality loss first in math, code, JSON, tool use)";
      quantWhy = "Q4 is the consumer sweet spot. Going below Q4 degrades reasoning, code, and structured output first.";
    } else if (priority === "speed") {
      quant = "Q4 (smaller weights = less memory movement during decode)";
      quantWhy = "Decode is memory-bandwidth-bound, so smaller quantized weights stream faster.";
    } else {
      quant = "Q4 or Q5 (Q5 if VRAM allows)";
      quantWhy = "Q4 is the default consumer sweet spot; Q5 buys quality cheaply if you have the headroom.";
    }
    fields.push({ label: "Weight quantization", value: quant, why: quantWhy, whyRef: "m2l5" });

    // ---- 4. KV cache mode ----
    let kv, kvWhy;
    if (context === "long") {
      kv = "FP8 or INT8 KV cache (FP16 baseline only if you have plenty of VRAM)";
      kvWhy = "Long context blows up KV cache memory. FP8/INT8 is the practical local floor in 2026; sub-8-bit is research-heavy.";
    } else if (context === "medium" && (hardware === "cpu" || hardware === "midGpu")) {
      kv = "Consider FP8/INT8 KV cache to leave headroom";
      kvWhy = "At 32K context, KV cache can rival the weights on smaller GPUs. Compress it before you spill.";
    } else {
      kv = "FP16/BF16 KV cache is fine";
      kvWhy = "At short context with adequate memory, KV cache compression is unnecessary overhead.";
    }
    fields.push({ label: "KV cache mode", value: kv, why: kvWhy, whyRef: "m1l5" });

    // ---- 5. Context length ----
    // Downgrade the long-context recommendation on weak tiers — even though
    // the user picked "long," the realistic setup on CPU / mid GPU is to
    // target 32K and let RAG handle the 128K-scale corpus.
    const weakTier = (hardware === "cpu" || hardware === "midGpu");
    let contextValue;
    let contextWhy;
    if (context === "long" && weakTier) {
      contextValue = "Target 32K first; use RAG / chunking for 128K-scale documents";
      contextWhy = "Your tier can technically open a 128K window but decode will crawl and KV cache will dominate memory. RAG narrows the corpus before the model sees it — better quality and far cheaper.";
    } else {
      contextValue = { short: "8K", medium: "32K", long: "128K+" }[context];
      contextWhy = "Set context only as long as you actually need. Supported length is a ceiling, not free capacity.";
    }
    fields.push({ label: "Context length", value: contextValue, why: contextWhy, whyRef: "m5l1" });

    // ---- 6. Runtime ----
    let runtime, runtimeWhy;
    if (useCase === "edge") {
      runtime = "MLC, WebLLM, or llama.cpp (depending on device)";
      runtimeWhy = "Edge runtimes are picked for the device — MLC/WebLLM for browsers/mobile, llama.cpp for embedded.";
    } else if (useCase === "agents" || useCase === "coding") {
      runtime = "llama.cpp or LM Studio for solo use; vLLM or SGLang once you need an OpenAI-compatible API or concurrency";
      runtimeWhy = "Agent/coding stacks usually want an HTTP endpoint and structured outputs — vLLM/SGLang handle that well at the team tier.";
    } else if (priority === "privacy") {
      runtime = "llama.cpp or LM Studio (fully offline-capable)";
      runtimeWhy = "Pick a runtime that doesn't phone home. Disable telemetry where applicable.";
    } else if (hardware === "blackwell" && (useCase === "documents" || useCase === "reasoning")) {
      runtime = "vLLM or SGLang for serving; TensorRT-LLM if you need maximum NVIDIA throughput";
      runtimeWhy = "Server-class workloads benefit from continuous batching, paged attention, and proper serving infrastructure.";
    } else {
      runtime = "LM Studio or Harbor (easiest); llama.cpp if you want the portable low-level workhorse";
      runtimeWhy = "Start with a desktop-first runtime, then move to vLLM/SGLang when you need a real API or concurrency.";
    }
    fields.push({ label: "Runtime", value: runtime, why: runtimeWhy, whyRef: "m4l1" });

    // ---- 7. Warnings ----
    if (context === "long" && (hardware === "cpu" || hardware === "midGpu")) {
      warnings.push({
        value: "Long context on your hardware tier is risky — KV cache can exceed your memory even though the weights fit. Test at half your target context first.",
        whyRef: "m1l5"
      });
    }
    if (useCase === "coding" && (hardware === "cpu" || hardware === "midGpu")) {
      warnings.push({
        value: "Small-VRAM coding is workable but limited. Expect to rely heavily on retrieval and tight repo context — a code model without tools is half a product.",
        whyRef: "m5l5"
      });
    }
    // Bandwidth-aware warning: low-bandwidth tiers + latency-sensitive workloads
    if ((hardware === "cpu" || hardware === "unifMid") && (useCase === "agents" || useCase === "coding")) {
      warnings.push({
        value: "Low-bandwidth tiers (~135–300 GB/s) decode much slower than discrete GPUs. Multi-step agent and code-iteration loops will feel sluggish — each step pays the full per-token bandwidth cost. Fine for documents and one-shot tasks; painful for agents.",
        whyRef: "m3l4"
      });
    }
    if (hardware === "appleHigh" && priority === "speed" && useCase === "agents") {
      warnings.push({
        value: "Apple Max/Ultra has the capacity for huge models but single-stream decode is slower than a discrete dGPU. If agent latency matters more than model size, an RTX 4090 or 5090 on a smaller model often wins.",
        whyRef: "m3l4"
      });
    }
    if (useCase === "agents") {
      warnings.push({
        value: "Tool use changes the safety model. Sandbox execution, validate tool arguments, treat retrieved inputs as hostile, and audit tool calls.",
        whyRef: "m5l6"
      });
    }
    if (priority === "cost" && (hardware === "cpu" || hardware === "midGpu")) {
      warnings.push({
        value: "Aggressive quantization (Q3/Q2) degrades math, code, JSON, and tool use first. A smaller model at higher precision often beats a larger model crushed too low.",
        whyRef: "m2l5"
      });
    }
    if (commercial === "yes") {
      warnings.push({
        value: "Open-weight ≠ opensource. Read the model card and license before deploying — some permissive-looking licenses have scale, attribution, or competitive-use restrictions.",
        whyRef: "m6l7"
      });
    }

    // ---- 8. Tips (always-on best practices) ----
    tips.push({
      value: "Verify the chat template. Wrong template → gibberish, role confusion, and bad evals — even on a great model.",
      whyRef: "m2l2"
    });
    tips.push({
      value: "Leave 10–20% memory headroom. Running at 99% VRAM is begging for OOM and fragmentation crashes.",
      whyRef: "m3l2"
    });
    tips.push({
      value: "Build a small eval set (20–50 prompts of your real tasks). Leaderboards are for discovery, not for choosing your local stack.",
      whyRef: "m6l5"
    });
    if (useCase === "documents") {
      tips.push({
        value: "Most bad RAG is bad chunking and retrieval, not a bad LLM. Inspect your parsed text and chunk boundaries first.",
        whyRef: "m5l3"
      });
    }
    if (priority === "privacy") {
      tips.push({
        value: "Local doesn't automatically mean secure. Prefer safetensors/GGUF from reputable sources, avoid trust_remote_code, and audit telemetry settings.",
        whyRef: "m6l6"
      });
    }
    tips.push({
      value: "When something feels wrong, start with the boring checks — template, memory, context length, decoding settings — before swapping models.",
      whyRef: "m6l8"
    });

    // ---- Summary string ----
    const summary = `For ${useCase} on ${hwTier.label} (capacity ${hwTier.capacity}, bandwidth ${hwTier.bandwidth}) with ${contextValue} context, prioritizing ${priority}: a ${modelSize} ${useCase === "coding" ? "code-capable" : useCase === "reasoning" ? "reasoning-tuned" : "instruct"} model at ${quant.split(" ")[0]}, running on ${runtime.split(",")[0].split(";")[0]}.`;

    return { summary, fields, warnings, tips, inputs };
  }
};
