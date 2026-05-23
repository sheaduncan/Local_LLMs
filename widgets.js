// Interactive widgets embedded in lessons. Each export is a mount function:
// fn(rootElement) — it builds its UI into rootElement.

window.WIDGETS = (function () {

  // ---------- Small helpers ----------
  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "class") e.className = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else if (k.startsWith("on") && typeof attrs[k] === "function") e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    if (children) (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }
  function fmtMiB(bytes) {
    const mib = bytes / (1024 * 1024);
    if (mib < 1024) return mib.toFixed(1) + " MiB";
    return (mib / 1024).toFixed(2) + " GiB";
  }
  function fmtGiB(bytes) { return (bytes / (1024 ** 3)).toFixed(2) + " GiB"; }
  function hashHue(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h) % 360;
  }

  // ============================================================
  // 1) TOKENIZER demo — regex heuristic with subword-ending splits.
  //    Pedagogically illustrates that tokens are sub-word chunks,
  //    not words. Counts are approximate (real tokenizers vary).
  // ============================================================
  function tokenizer(root) {
    root.innerHTML = `
      <div class="widget-title">Tokenizer demo</div>
      <textarea id="tok-input" rows="3" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:5px;font-family:inherit;font-size:14px;">Tokens are how the model sees your prompt — internationalization splits into smaller pieces, and special markers like <|user|> get their own token.</textarea>
      <div style="margin-top:10px;" class="tok-display" id="tok-out"></div>
      <div class="tok-meta">
        <span>Chars: <strong id="tok-chars">0</strong></span>
        <span>Approx tokens: <strong id="tok-count">0</strong></span>
        <span>Ratio: <strong id="tok-ratio">–</strong> chars/token</span>
      </div>
      <p style="font-size:12.5px;color:var(--text-mute);margin-top:10px;">Heuristic only — real BPE/SentencePiece tokenizers produce different splits per model family. The point: tokens are sub-word chunks, special markers get their own token, and totals vary.</p>
    `;

    const SUFFIXES = ["tion", "sion", "ment", "ness", "able", "ible", "ing", "ization", "ational", "ize", "ly", "ed", "er", "est", "es", "s"];

    function tokenize(text) {
      // Split into chunks: words / numbers / whitespace / punctuation / special markers
      const out = [];
      const re = /<\|[^>]+\|>|\[\/?INST\]|\[BOS\]|\[EOS\]|[A-Za-z]+|[0-9]+|\s+|[^A-Za-z0-9\s]/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const chunk = m[0];
        // Special markers and short pieces — keep whole
        if (chunk.startsWith("<|") || chunk.startsWith("[") || chunk.length <= 4 || !/^[A-Za-z]+$/.test(chunk)) {
          out.push(chunk);
          continue;
        }
        // Split off known suffixes
        let head = chunk;
        const tail = [];
        let changed = true;
        while (changed && head.length > 4) {
          changed = false;
          for (const sfx of SUFFIXES) {
            if (head.length > sfx.length + 2 && head.toLowerCase().endsWith(sfx)) {
              tail.unshift(head.slice(head.length - sfx.length));
              head = head.slice(0, head.length - sfx.length);
              changed = true;
              break;
            }
          }
        }
        // For remaining long words, break every ~4-5 chars
        if (head.length > 6) {
          for (let i = 0; i < head.length; i += 4) out.push(head.slice(i, i + 4));
        } else {
          out.push(head);
        }
        for (const t of tail) out.push(t);
      }
      return out;
    }

    function render() {
      const text = root.querySelector("#tok-input").value;
      const tokens = tokenize(text);
      const out = root.querySelector("#tok-out");
      out.innerHTML = "";
      tokens.forEach(t => {
        const hue = hashHue(t);
        const span = document.createElement("span");
        span.className = "tok";
        span.style.background = `hsl(${hue} 70% 88%)`;
        span.style.color = `hsl(${hue} 50% 25%)`;
        span.textContent = t.replace(/ /g, "·").replace(/\n/g, "↵");
        out.appendChild(span);
      });
      const chars = text.length;
      const count = tokens.length;
      root.querySelector("#tok-chars").textContent = chars;
      root.querySelector("#tok-count").textContent = count;
      root.querySelector("#tok-ratio").textContent = count > 0 ? (chars / count).toFixed(2) : "–";
    }

    root.querySelector("#tok-input").addEventListener("input", render);
    render();
  }

  // ============================================================
  // 2) KV CACHE calculator — context × layers × kv_heads × head_dim × bytes × 2
  // ============================================================
  const KV_PRESETS = [
    { name: "Qwen 2.5 7B (GQA)",        layers: 28, kv_heads: 4,  head_dim: 128, ctx: 8192 },
    { name: "Llama 3 8B (GQA)",         layers: 32, kv_heads: 8,  head_dim: 128, ctx: 8192 },
    { name: "Llama 2 13B (MHA)",        layers: 40, kv_heads: 40, head_dim: 128, ctx: 4096 },
    { name: "Qwen 3.6 27B (approx)",    layers: 64, kv_heads: 4,  head_dim: 256, ctx: 32768 },
    { name: "Llama 70B (GQA)",          layers: 80, kv_heads: 8,  head_dim: 128, ctx: 8192 }
  ];

  function kvCacheCalc(root) {
    root.innerHTML = `
      <div class="widget-title">KV cache calculator</div>
      <div class="presets" id="kv-presets"></div>
      <div class="widget-row"><label>Context tokens</label><input type="number" id="kv-ctx" value="8192" min="1"></div>
      <div class="widget-row"><label>Layers</label><input type="number" id="kv-layers" value="32" min="1"></div>
      <div class="widget-row"><label>KV heads</label><input type="number" id="kv-kvh" value="8" min="1"></div>
      <div class="widget-row"><label>Head dim</label><input type="number" id="kv-hdim" value="128" min="1"></div>
      <div class="widget-row"><label>KV precision</label>
        <select id="kv-prec">
          <option value="2">FP16 / BF16 (2 bytes)</option>
          <option value="1">FP8 / INT8 (1 byte)</option>
        </select>
      </div>
      <div class="widget-row"><label>Batch / concurrent reqs</label><input type="number" id="kv-batch" value="1" min="1"></div>
      <div class="widget-output" id="kv-out"></div>
    `;
    const $ = sel => root.querySelector(sel);

    const presets = $("#kv-presets");
    KV_PRESETS.forEach(p => {
      const btn = el("button", { class: "preset-btn", onclick: () => {
        $("#kv-ctx").value = p.ctx;
        $("#kv-layers").value = p.layers;
        $("#kv-kvh").value = p.kv_heads;
        $("#kv-hdim").value = p.head_dim;
        recalc();
      }}, [p.name]);
      presets.appendChild(btn);
    });

    function recalc() {
      const ctx = +$("#kv-ctx").value;
      const layers = +$("#kv-layers").value;
      const kvh = +$("#kv-kvh").value;
      const hdim = +$("#kv-hdim").value;
      const prec = +$("#kv-prec").value;
      const batch = +$("#kv-batch").value;
      const bytes = ctx * layers * kvh * hdim * prec * 2 * batch;
      const perToken = bytes / ctx / batch;
      $("#kv-out").innerHTML = `
        <table>
          <tr><th>Total KV cache</th><td><strong>${fmtMiB(bytes)}</strong></td></tr>
          <tr><th>Per token</th><td>${fmtMiB(perToken)} (${(perToken / 1024).toFixed(1)} KiB/token/batch)</td></tr>
          <tr><th>Formula</th><td style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;">${ctx} × ${layers} × ${kvh} × ${hdim} × ${prec} × 2 × ${batch}</td></tr>
        </table>
        ${bytes > 16 * 1024 ** 3 ? '<div class="verdict bad">Over 16 GiB — bigger than most consumer VRAM available for cache alone.</div>'
          : bytes > 8 * 1024 ** 3 ? '<div class="verdict warn">Over 8 GiB just in KV cache. Combined with weights, this is tight on 24 GB GPUs.</div>'
          : ''}
      `;
    }

    root.querySelectorAll("input, select").forEach(i => i.addEventListener("input", recalc));
    recalc();
  }

  // ============================================================
  // 3) VRAM calculator — full memory bill
  // ============================================================
  const QUANT_BYTES = { fp16: 2, q8: 1, q6: 0.75, q5: 0.625, q4: 0.5, q3: 0.375 };
  const VRAM_PRESETS = [
    { name: "Qwen 7B Q4 / 16K",          params: 7,  quant: "q4", ctx: 16384, layers: 28, kvh: 4,  hdim: 128, vram: 16 },
    { name: "Llama 13B Q4 / 8K",         params: 13, quant: "q4", ctx: 8192,  layers: 40, kvh: 40, hdim: 128, vram: 24 },
    { name: "Qwen 3.6 27B Q4 / 32K",     params: 27, quant: "q4", ctx: 32768, layers: 64, kvh: 4,  hdim: 256, vram: 24 },
    { name: "Llama 70B Q4 / 8K",         params: 70, quant: "q4", ctx: 8192,  layers: 80, kvh: 8,  hdim: 128, vram: 48 }
  ];

  function vramCalc(root) {
    root.innerHTML = `
      <div class="widget-title">VRAM math calculator</div>
      <div class="presets" id="vr-presets"></div>
      <div class="widget-row"><label>Model params (B)</label><input type="number" id="vr-params" value="13" min="0.1" step="0.5"></div>
      <div class="widget-row"><label>Quantization</label>
        <select id="vr-quant">
          <option value="fp16">FP16 / BF16</option>
          <option value="q8">Q8 / INT8</option>
          <option value="q6">Q6</option>
          <option value="q5">Q5</option>
          <option value="q4" selected>Q4 (sweet spot)</option>
          <option value="q3">Q3</option>
        </select>
      </div>
      <div class="widget-row"><label>Context tokens</label><input type="number" id="vr-ctx" value="8192" min="1"></div>
      <div class="widget-row"><label>Layers</label><input type="number" id="vr-layers" value="40" min="1"></div>
      <div class="widget-row"><label>KV heads</label><input type="number" id="vr-kvh" value="40" min="1"></div>
      <div class="widget-row"><label>Head dim</label><input type="number" id="vr-hdim" value="128" min="1"></div>
      <div class="widget-row"><label>KV precision</label>
        <select id="vr-kvprec">
          <option value="2">FP16 / BF16</option>
          <option value="1">FP8 / INT8</option>
        </select>
      </div>
      <div class="widget-row"><label>Batch</label><input type="number" id="vr-batch" value="1" min="1"></div>
      <div class="widget-row"><label>VRAM available (GB)</label><input type="number" id="vr-vram" value="24" min="1"></div>
      <div class="widget-output" id="vr-out"></div>
    `;
    const $ = sel => root.querySelector(sel);

    const presets = $("#vr-presets");
    VRAM_PRESETS.forEach(p => {
      const btn = el("button", { class: "preset-btn", onclick: () => {
        $("#vr-params").value = p.params;
        $("#vr-quant").value = p.quant;
        $("#vr-ctx").value = p.ctx;
        $("#vr-layers").value = p.layers;
        $("#vr-kvh").value = p.kvh;
        $("#vr-hdim").value = p.hdim;
        $("#vr-vram").value = p.vram;
        recalc();
      }}, [p.name]);
      presets.appendChild(btn);
    });

    function recalc() {
      const params = +$("#vr-params").value;
      const quant = $("#vr-quant").value;
      const ctx = +$("#vr-ctx").value;
      const layers = +$("#vr-layers").value;
      const kvh = +$("#vr-kvh").value;
      const hdim = +$("#vr-hdim").value;
      const kvprec = +$("#vr-kvprec").value;
      const batch = +$("#vr-batch").value;
      const vram = +$("#vr-vram").value;

      const bytesPerParam = QUANT_BYTES[quant];
      const weightBytes = params * 1e9 * bytesPerParam;
      const kvBytes = ctx * layers * kvh * hdim * kvprec * 2 * batch;
      const overheadBytes = 1.5 * 1024 ** 3;     // ~1.5 GiB runtime overhead
      const total = weightBytes + kvBytes + overheadBytes;
      const vramBytes = vram * 1024 ** 3;
      const usagePct = (total / vramBytes) * 100;

      let verdict;
      if (usagePct < 80) verdict = `<div class="verdict ok">Fits comfortably (${usagePct.toFixed(0)}% of VRAM). You have headroom.</div>`;
      else if (usagePct < 95) verdict = `<div class="verdict warn">Tight (${usagePct.toFixed(0)}% of VRAM). Less than 10–20% headroom — risk of OOM under load.</div>`;
      else if (usagePct < 100) verdict = `<div class="verdict bad">Very tight (${usagePct.toFixed(0)}% of VRAM). Expect crashes. Use less context, smaller model, or smaller quant.</div>`;
      else verdict = `<div class="verdict bad">Does NOT fit (${usagePct.toFixed(0)}% of VRAM). Reduce model size, context, or quantization.</div>`;

      $("#vr-out").innerHTML = `
        <table>
          <tr><th>Weights (${quant.toUpperCase()})</th><td>${fmtGiB(weightBytes)}</td></tr>
          <tr><th>KV cache (${kvprec === 2 ? "FP16" : "FP8/INT8"})</th><td>${fmtGiB(kvBytes)}</td></tr>
          <tr><th>Runtime overhead</th><td>${fmtGiB(overheadBytes)}</td></tr>
          <tr><th><strong>Total</strong></th><td><strong>${fmtGiB(total)} / ${vram} GB available</strong></td></tr>
        </table>
        ${verdict}
      `;
    }

    root.querySelectorAll("input, select").forEach(i => i.addEventListener("input", recalc));
    recalc();
  }

  // ============================================================
  // 4) DECODING PLAYGROUND — toy distribution, sample with controls
  // ============================================================
  const TOY_LOGITS = [
    ["mat",     6.8],
    ["floor",   5.2],
    ["chair",   4.7],
    ["couch",   4.1],
    ["bed",     3.8],
    ["ground",  3.2],
    ["table",   2.9],
    ["step",    2.5],
    ["rug",     2.1],
    ["carpet",  1.7],
    ["sofa",    1.2],
    ["box",     0.8],
    ["ledge",   0.3],
    ["thing",  -0.2]
  ];

  function decodingPlayground(root) {
    root.innerHTML = `
      <div class="widget-title">Decoding playground</div>
      <p style="font-size:13.5px;color:var(--text-dim);margin:0 0 12px;">Prompt: <em>"The cat sat on the ___"</em>. Below are the model's raw logits for candidate next tokens. Adjust temperature, top-p, top-k and watch the distribution reshape.</p>
      <div class="widget-row"><label>Temperature</label>
        <div class="with-suffix">
          <input type="range" id="dec-temp" min="0.1" max="2.0" step="0.05" value="1.0">
          <span class="suffix" id="dec-temp-v">1.00</span>
        </div>
      </div>
      <div class="widget-row"><label>Top-p</label>
        <div class="with-suffix">
          <input type="range" id="dec-topp" min="0.05" max="1.0" step="0.05" value="1.0">
          <span class="suffix" id="dec-topp-v">1.00</span>
        </div>
      </div>
      <div class="widget-row"><label>Top-k</label>
        <div class="with-suffix">
          <input type="range" id="dec-topk" min="1" max="14" step="1" value="14">
          <span class="suffix" id="dec-topk-v">14</span>
        </div>
      </div>
      <div class="dec-bars" id="dec-bars"></div>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="preset-btn" id="dec-sample">Sample 20</button>
        <button class="preset-btn" id="dec-greedy">Greedy pick</button>
        <button class="preset-btn" id="dec-reset">Reset</button>
      </div>
      <div class="dec-counts" id="dec-counts"></div>
    `;
    const $ = sel => root.querySelector(sel);

    function recompute() {
      const T = +$("#dec-temp").value;
      const topP = +$("#dec-topp").value;
      const topK = +$("#dec-topk").value;
      $("#dec-temp-v").textContent = T.toFixed(2);
      $("#dec-topp-v").textContent = topP.toFixed(2);
      $("#dec-topk-v").textContent = topK;

      // Softmax(logits / T)
      const scaled = TOY_LOGITS.map(([w, l]) => [w, l / T]);
      const maxL = Math.max(...scaled.map(s => s[1]));
      const exps = scaled.map(([w, l]) => [w, Math.exp(l - maxL)]);
      const Z = exps.reduce((s, [, v]) => s + v, 0);
      const probs = exps.map(([w, v]) => [w, v / Z]);

      // Top-k filter
      const sorted = [...probs].sort((a, b) => b[1] - a[1]).slice(0, topK);
      // Top-p cumulative
      let cum = 0; const pool = [];
      for (const item of sorted) {
        pool.push(item);
        cum += item[1];
        if (cum >= topP) break;
      }
      const poolSet = new Set(pool.map(p => p[0]));

      const bars = $("#dec-bars");
      bars.innerHTML = "";
      probs.forEach(([w, p]) => {
        const inPool = poolSet.has(w);
        bars.appendChild(el("div", { class: "dec-bar " + (inPool ? "in-pool" : "out-pool") }, [
          el("span", null, [w]),
          el("div", { class: "dec-bar-fill" }, [
            el("div", { class: "inner", style: `width:${(p * 100).toFixed(1)}%` })
          ]),
          el("span", { class: "pct" }, [(p * 100).toFixed(1) + "%"])
        ]));
      });

      return { probs, pool };
    }

    function sample(n) {
      const { pool } = recompute();
      if (pool.length === 0) return;
      // Renormalize pool
      const Z = pool.reduce((s, [, p]) => s + p, 0);
      const counts = {};
      for (let i = 0; i < n; i++) {
        let r = Math.random() * Z;
        for (const [w, p] of pool) { r -= p; if (r <= 0) { counts[w] = (counts[w] || 0) + 1; break; } }
      }
      const counts$ = $("#dec-counts");
      counts$.innerHTML = "";
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      sorted.forEach(([w, c]) => counts$.appendChild(el("span", { class: "dec-count-chip" }, [`${w}: ${c}`])));
    }

    $("#dec-sample").addEventListener("click", () => sample(20));
    $("#dec-greedy").addEventListener("click", () => {
      const { probs } = recompute();
      const top = probs.reduce((a, b) => b[1] > a[1] ? b : a);
      $("#dec-counts").innerHTML = "";
      $("#dec-counts").appendChild(el("span", { class: "dec-count-chip" }, [`Greedy → ${top[0]} (always the same)`]));
    });
    $("#dec-reset").addEventListener("click", () => {
      $("#dec-temp").value = 1.0;
      $("#dec-topp").value = 1.0;
      $("#dec-topk").value = 14;
      $("#dec-counts").innerHTML = "";
      recompute();
    });

    root.querySelectorAll('input[type="range"]').forEach(i => i.addEventListener("input", recompute));
    recompute();
  }

  // ============================================================
  // 5) QUANTIZATION TABLE — model size × precision → fit on common GPUs
  // ============================================================
  function quantizationTable(root) {
    root.innerHTML = `
      <div class="widget-title">Quantization comparison</div>
      <div class="widget-row"><label>Model params (B)</label>
        <div class="with-suffix">
          <input type="range" id="qt-params" min="1" max="70" step="1" value="13">
          <span class="suffix" id="qt-params-v">13 B</span>
        </div>
      </div>
      <div class="widget-row"><label>KV + overhead reserve</label>
        <div class="with-suffix">
          <input type="range" id="qt-reserve" min="0" max="20" step="0.5" value="3">
          <span class="suffix" id="qt-reserve-v">3 GB</span>
        </div>
      </div>
      <div class="widget-output" id="qt-out"></div>
      <p style="font-size:12.5px;color:var(--text-mute);margin-top:10px;">Weight memory only. "Fits?" assumes the reserve covers KV cache, runtime overhead, and 10–20% headroom — adjust the reserve for your context length.</p>
    `;
    const $ = sel => root.querySelector(sel);

    const PRECISIONS = [
      { name: "FP16/BF16", bytes: 2,     note: "baseline quality" },
      { name: "Q8 / INT8", bytes: 1,     note: "near-lossless" },
      { name: "Q6",        bytes: 0.75,  note: "strong middle" },
      { name: "Q5",        bytes: 0.625, note: "very good" },
      { name: "Q4",        bytes: 0.5,   note: "consumer sweet spot" },
      { name: "Q3",        bytes: 0.375, note: "use with caution" }
    ];
    const GPUS = [8, 12, 16, 24, 48];

    function recalc() {
      const params = +$("#qt-params").value;
      const reserve = +$("#qt-reserve").value;
      $("#qt-params-v").textContent = params + " B";
      $("#qt-reserve-v").textContent = reserve + " GB";

      const rows = PRECISIONS.map(p => {
        const sizeGB = params * p.bytes;
        const cells = GPUS.map(gb => {
          const available = gb - reserve;
          const ratio = sizeGB / available;
          let cls, txt;
          if (sizeGB > gb) { cls = "fit-no"; txt = "no"; }
          else if (ratio > 0.95) { cls = "fit-no"; txt = "no (oom)"; }
          else if (ratio > 0.80) { cls = "fit-tight"; txt = "tight"; }
          else { cls = "fit-yes"; txt = "fits"; }
          return `<td class="${cls}">${txt}</td>`;
        }).join("");
        return `<tr><td><strong>${p.name}</strong> <span style="color:var(--text-mute);font-size:12px;">${p.note}</span></td><td>${sizeGB.toFixed(1)} GB</td>${cells}</tr>`;
      }).join("");

      $("#qt-out").innerHTML = `
        <table>
          <tr><th>Precision</th><th>Weights</th>${GPUS.map(g => `<th>${g} GB</th>`).join("")}</tr>
          ${rows}
        </table>
      `;
    }

    root.querySelectorAll("input").forEach(i => i.addEventListener("input", recalc));
    recalc();
  }

  // ============================================================
  // 6) MODEL TYPE EXPLORER — pick a model type + scenario, see how
  //    inputs and outputs change.
  // ============================================================
  const MTE_TYPES = [
    { id: "base",      label: "Base",        desc: "Pretrained on raw text. Not tuned to answer — it continues whatever you give it." },
    { id: "instruct",  label: "Instruct",    desc: "Fine-tuned to follow instructions directly. The default starting point for most users." },
    { id: "chat",      label: "Chat",        desc: "Tuned for multi-turn dialogue. Expects a system prompt and assistant/user turns." },
    { id: "reasoning", label: "Reasoning",   desc: "Thinks before answering, often in a <think> block. Good for math, code, multi-step problems." },
    { id: "tool",      label: "Tool-tuned",  desc: "Trained to emit structured tool calls (JSON) and pull in external info when needed." }
  ];

  const MTE_SCENARIOS = [
    { id: "factual",  label: "Factual question", prompt: "What is the capital of France?" },
    { id: "code",     label: "Code task",        prompt: "Write a Python function that reverses a string." },
    { id: "math",     label: "Math reasoning",   prompt: "Train A leaves at 3pm going 60mph east. Train B leaves at 4pm from the same spot going 75mph east. When does B catch A?" },
    { id: "weather",  label: "Needs a tool",     prompt: "What's the weather in Paris right now?" },
    { id: "casual",   label: "Casual chat",      prompt: "How are you today?" }
  ];

  // Data: MTE_RESPONSES[modelType][scenarioId] = { sees, output, note }
  const MTE_RESPONSES = {
    base: {
      factual: {
        sees:   `What is the capital of France?`,
        output: `What is the population of Paris? What is the official language? When was Paris founded? These are all questions tourists often ask. The capital of France is Paris, a city on the Seine river dating back to Roman times…`,
        note:   `Base completes the prompt like a textbook page — it keeps generating related text rather than answering.`
      },
      code: {
        sees:   `Write a Python function that reverses a string.`,
        output: `Write a Python function that reverses a string. Also write a JavaScript version. Use list slicing where possible. Below is a docstring example you can adapt for your CS homework…`,
        note:   `No instruction-following. The model treats your prompt as the start of an article and just keeps writing.`
      },
      math: {
        sees:   `Train A leaves at 3pm going 60mph east. Train B leaves at 4pm from the same spot going 75mph east. When does B catch A?`,
        output: `Train A leaves at 3pm going 60mph east. Train B leaves at 4pm from the same spot going 75mph east. When does B catch A? This is a classic word problem from algebra class. Many students struggle with it. Let's set up the equations…`,
        note:   `Often just repeats and meanders — it sees the prompt as text to continue, not a question to solve.`
      },
      weather: {
        sees:   `What's the weather in Paris right now?`,
        output: `What's the weather in Paris right now? It's a question many travelers ask. Paris has a temperate maritime climate. In spring, expect mild temperatures around 15°C…`,
        note:   `Can't acknowledge limits or call tools — just produces plausible-sounding text near the topic.`
      },
      casual: {
        sees:   `How are you today?`,
        output: `How are you today? I hope you're doing well. The weather has been lovely lately. Did you catch the game last night? Yes, what a finish!`,
        note:   `Continues a conversation as if it were a transcript, with both sides spoken.`
      }
    },
    instruct: {
      factual: {
        sees:   `<|user|>\nWhat is the capital of France?\n<|assistant|>\n`,
        output: `The capital of France is Paris.`,
        note:   `Direct answer. Instruct is tuned to recognize a question and produce a focused response.`
      },
      code: {
        sees:   `<|user|>\nWrite a Python function that reverses a string.\n<|assistant|>\n`,
        output: `def reverse_string(s):\n    return s[::-1]`,
        note:   `Returns just the code, no fluff. Useful default for terse, focused tasks.`
      },
      math: {
        sees:   `<|user|>\nTrain A leaves at 3pm going 60mph east. Train B leaves at 4pm from the same spot going 75mph east. When does B catch A?\n<|assistant|>\n`,
        output: `Train B catches Train A 4 hours after B leaves, at 8pm. (B is 15mph faster; A has a 60-mile head start by 4pm; 60 ÷ 15 = 4 hours.)`,
        note:   `Gives an answer with a brief justification. May get harder problems wrong — no explicit thinking step.`
      },
      weather: {
        sees:   `<|user|>\nWhat's the weather in Paris right now?\n<|assistant|>\n`,
        output: `I don't have real-time data, so I can't tell you the current weather in Paris. Try a service like weather.com or your phone's weather app.`,
        note:   `Recognizes a limit and says so honestly. No tool-call capability built in.`
      },
      casual: {
        sees:   `<|user|>\nHow are you today?\n<|assistant|>\n`,
        output: `I'm an AI, so I don't have feelings — but I'm ready to help. What can I do for you?`,
        note:   `Polite but a bit robotic. Less chatty than a chat-tuned model.`
      }
    },
    chat: {
      factual: {
        sees:   `<|system|>\nYou are a helpful assistant.\n<|user|>\nWhat is the capital of France?\n<|assistant|>\n`,
        output: `The capital of France is Paris! It's also the country's largest city and a major cultural hub. Anything else you'd like to know?`,
        note:   `Conversational, follows up. Chat models add warmth and assume an ongoing dialogue.`
      },
      code: {
        sees:   `<|system|>\nYou are a helpful assistant.\n<|user|>\nWrite a Python function that reverses a string.\n<|assistant|>\n`,
        output: `Here's a one-liner:\n\ndef reverse_string(s):\n    return s[::-1]\n\nLet me know if you want an iterative version or one that handles Unicode edge cases!`,
        note:   `Code + explanation + offer to elaborate. Chat models prefer to keep the conversation going.`
      },
      math: {
        sees:   `<|system|>\nYou are a helpful assistant.\n<|user|>\nTrain A leaves at 3pm going 60mph east. Train B leaves at 4pm from the same spot going 75mph east. When does B catch A?\n<|assistant|>\n`,
        output: `Let me work through this. A has a 60-mile head start by 4pm. B gains 15mph on A, so it takes 60 ÷ 15 = 4 hours. They meet at 8pm. 🚂`,
        note:   `Walks through the steps in friendly prose. Still no formal thinking block.`
      },
      weather: {
        sees:   `<|system|>\nYou are a helpful assistant.\n<|user|>\nWhat's the weather in Paris right now?\n<|assistant|>\n`,
        output: `I can't pull live weather data on my own. If you share what you've found — or hook me up with a weather tool — I can help interpret it!`,
        note:   `Same limit as instruct, but friendlier framing. Invites the user to provide context.`
      },
      casual: {
        sees:   `<|system|>\nYou are a helpful assistant.\n<|user|>\nHow are you today?\n<|assistant|>\n`,
        output: `Doing great, thanks for asking! 😊 How about you — anything I can help with today?`,
        note:   `Warm, engages back. Chat tuning makes casual conversation feel natural.`
      }
    },
    reasoning: {
      factual: {
        sees:   `<|user|>\nWhat is the capital of France?\n<|assistant|>\n<think>`,
        output: `<think>\nBasic geography question. The capital of France is Paris — well-established fact, no ambiguity.\n</think>\nThe capital of France is Paris.`,
        note:   `For trivial questions, the thinking block is short. The cost is still paid in tokens, though.`
      },
      code: {
        sees:   `<|user|>\nWrite a Python function that reverses a string.\n<|assistant|>\n<think>`,
        output: `<think>\nUser wants a Python function to reverse a string. Two common approaches: slicing s[::-1] (idiomatic) or reversed(s) joined back. Slicing is shortest and clearest. I'll go with that.\n</think>\ndef reverse_string(s):\n    return s[::-1]`,
        note:   `Reasoning models often pick the cleanest approach by weighing options in the think block before answering.`
      },
      math: {
        sees:   `<|user|>\nTrain A leaves at 3pm going 60mph east. Train B leaves at 4pm from the same spot going 75mph east. When does B catch A?\n<|assistant|>\n<think>`,
        output: `<think>\nA leaves at 3pm at 60mph. By 4pm, A is 60 miles ahead.\nB leaves at 4pm at 75mph.\nRelative speed: 75 − 60 = 15 mph.\nTime to close 60-mile gap: 60 ÷ 15 = 4 hours.\nMeeting time: 4pm + 4h = 8pm.\n</think>\nTrain B catches Train A at 8pm.`,
        note:   `This is where reasoning models earn their keep — step-by-step thinking catches arithmetic and setup errors that instruct models often miss.`
      },
      weather: {
        sees:   `<|user|>\nWhat's the weather in Paris right now?\n<|assistant|>\n<think>`,
        output: `<think>\nUser wants current weather. I don't have real-time access. Should be upfront and suggest alternatives.\n</think>\nI don't have access to real-time weather data. Try a weather app or service for current conditions in Paris.`,
        note:   `Thinking helps the model recognize it's outside its capabilities before answering.`
      },
      casual: {
        sees:   `<|user|>\nHow are you today?\n<|assistant|>\n<think>`,
        output: `<think>\nCasual greeting. No reasoning needed. Respond briefly and conversationally.\n</think>\nI'm doing well, thanks! What's up?`,
        note:   `For casual chat the think block is wasted tokens. Some models skip it; others always emit one.`
      }
    },
    tool: {
      factual: {
        sees:   `tools: [search, calculator]\n<|user|>\nWhat is the capital of France?\n<|assistant|>\n`,
        output: `The capital of France is Paris.\n\n(No tool call — this is direct knowledge.)`,
        note:   `Tool-tuned models decide whether a tool is needed. Trivial facts don't trigger a call.`
      },
      code: {
        sees:   `tools: [run_python, search]\n<|user|>\nWrite a Python function that reverses a string.\n<|assistant|>\n`,
        output: `def reverse_string(s):\n    return s[::-1]\n\nWant me to run this with run_python to verify on examples?`,
        note:   `Code + an offer to verify with the run_python tool. Tool models think in terms of available actions.`
      },
      math: {
        sees:   `tools: [calculator]\n<|user|>\nTrain A leaves at 3pm going 60mph east. Train B leaves at 4pm from the same spot going 75mph east. When does B catch A?\n<|assistant|>\n`,
        output: `{\n  "tool_call": {\n    "name": "calculator",\n    "arguments": { "expr": "60 / (75 - 60)" }\n  }\n}\n\n(Tool returns 4.0)\n\nB catches A 4 hours after leaving — at 8pm.`,
        note:   `Emits a structured JSON call, gets the result, then composes the human answer. Schema-validated by the runtime.`
      },
      weather: {
        sees:   `tools: [get_weather]\n<|user|>\nWhat's the weather in Paris right now?\n<|assistant|>\n`,
        output: `{\n  "tool_call": {\n    "name": "get_weather",\n    "arguments": { "location": "Paris, France" }\n  }\n}\n\n(Tool returns: {"temp_c": 14, "conditions": "partly cloudy"})\n\nIt's 14°C and partly cloudy in Paris right now.`,
        note:   `Exactly what tool models exist for. Structured call → real data → grounded answer.`
      },
      casual: {
        sees:   `tools: [get_weather, search]\n<|user|>\nHow are you today?\n<|assistant|>\n`,
        output: `I'm good — no tools needed for that one! What can I help you with?`,
        note:   `Tool models still handle plain conversation. The tools are options, not obligations.`
      }
    }
  };

  function modelTypeExplorer(root) {
    let typeId = "instruct";
    let scenarioId = "factual";

    root.innerHTML = `
      <div class="widget-title">Model type explorer</div>
      <p style="font-size:13px;color:var(--text-dim);margin:0 0 10px;">Pick a model type and a scenario. See what the model receives and what it returns.</p>
      <div class="mte-type-tabs" id="mte-type-tabs"></div>
      <div class="mte-type-desc" id="mte-type-desc"></div>
      <div class="mte-row"><span class="mte-row-label">Scenario:</span><div class="mte-chips" id="mte-scenarios"></div></div>
      <div class="mte-panes">
        <div class="mte-pane">
          <div class="mte-pane-label">1. What you type</div>
          <div class="mte-box mte-user" id="mte-user"></div>
        </div>
        <div class="mte-pane">
          <div class="mte-pane-label">2. What the model actually sees</div>
          <div class="mte-box mte-sees" id="mte-sees"></div>
        </div>
        <div class="mte-pane">
          <div class="mte-pane-label">3. What the model returns</div>
          <div class="mte-box mte-output" id="mte-output"></div>
        </div>
      </div>
      <div class="mte-note" id="mte-note"></div>
    `;
    const $ = sel => root.querySelector(sel);

    function renderTabs() {
      const wrap = $("#mte-type-tabs");
      wrap.innerHTML = "";
      MTE_TYPES.forEach(t => {
        const b = el("button", {
          class: "mte-tab" + (t.id === typeId ? " active" : ""),
          onclick: () => { typeId = t.id; paint(); }
        }, [t.label]);
        wrap.appendChild(b);
      });
    }
    function renderChips() {
      const wrap = $("#mte-scenarios");
      wrap.innerHTML = "";
      MTE_SCENARIOS.forEach(s => {
        const b = el("button", {
          class: "mte-chip" + (s.id === scenarioId ? " active" : ""),
          onclick: () => { scenarioId = s.id; paint(); }
        }, [s.label]);
        wrap.appendChild(b);
      });
    }
    function highlight(text) {
      // Escape, then wrap special chat tokens in a span
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/(\&lt;\|[a-z_]+\|\&gt;)/g, '<span class="mte-tok">$1</span>')
        .replace(/(\&lt;think\&gt;|\&lt;\/think\&gt;)/g, '<span class="mte-think">$1</span>')
        .replace(/(\[\/?INST\])/g, '<span class="mte-tok">$1</span>')
        .replace(/^(tools: \[[^\]]+\])$/gm, '<span class="mte-tok">$1</span>');
    }
    function paint() {
      renderTabs();
      renderChips();
      const t = MTE_TYPES.find(x => x.id === typeId);
      $("#mte-type-desc").textContent = t.desc;
      const sc = MTE_SCENARIOS.find(x => x.id === scenarioId);
      const r = MTE_RESPONSES[typeId][scenarioId];
      $("#mte-user").textContent = sc.prompt;
      $("#mte-sees").innerHTML = highlight(r.sees);
      $("#mte-output").innerHTML = highlight(r.output);
      $("#mte-note").textContent = r.note;
    }
    paint();
  }

  // ============================================================
  // 7) CHAT TEMPLATE EXPLORER — pick a model family's template,
  //    edit system + user, see the exact tokenizer input.
  // ============================================================
  const CT_TEMPLATES = [
    {
      id: "llama3",
      label: "Llama 3 / 3.1+",
      desc: "Meta's Llama 3 family. Header IDs delimit roles; <|eot_id|> ends every turn.",
      render(system, user) {
        let out = "<|begin_of_text|>";
        if (system.trim()) out += `<|start_header_id|>system<|end_header_id|>\n\n${system}<|eot_id|>`;
        out += `<|start_header_id|>user<|end_header_id|>\n\n${user}<|eot_id|>`;
        out += `<|start_header_id|>assistant<|end_header_id|>\n\n`;
        return out;
      },
      note: "Common bug: forgetting <|eot_id|> after each turn. Without it the model has no idea when a turn ends and may keep generating user-style content."
    },
    {
      id: "mistral",
      label: "Mistral / Llama 2 [INST]",
      desc: "The classic [INST] format. System content goes inside <<SYS>>…<</SYS>> on the first turn only.",
      render(system, user) {
        if (system.trim()) {
          return `<s>[INST] <<SYS>>\n${system}\n<</SYS>>\n\n${user} [/INST]`;
        }
        return `<s>[INST] ${user} [/INST]`;
      },
      note: "On follow-up turns you do NOT repeat <<SYS>>. Only the very first turn carries the system block — getting this wrong silently breaks long chats."
    },
    {
      id: "chatml",
      label: "ChatML (Qwen, …)",
      desc: "The ChatML style. Originally from OpenAI; now used by Qwen 2/3 and many other modern open-weight models.",
      render(system, user) {
        let out = "";
        if (system.trim()) out += `<|im_start|>system\n${system}<|im_end|>\n`;
        out += `<|im_start|>user\n${user}<|im_end|>\n`;
        out += `<|im_start|>assistant\n`;
        return out;
      },
      note: "Don't forget the trailing newline after <|im_start|>assistant — the model expects the answer to begin on the next line, not right after the tag."
    },
    {
      id: "gemma",
      label: "Gemma",
      desc: "Google Gemma. Has NO separate system role — system content must be folded into the first user turn.",
      render(system, user) {
        const merged = system.trim() ? `${system}\n\n${user}` : user;
        let out = "<bos>";
        out += `<start_of_turn>user\n${merged}<end_of_turn>\n`;
        out += `<start_of_turn>model\n`;
        return out;
      },
      note: "Common bug: sending a separate <|system|>… block (copy-pasted from another model) — Gemma silently ignores it. The system prompt MUST be prepended to the user message."
    },
    {
      id: "qwen3-think",
      label: "Qwen 3 (thinking)",
      desc: "Qwen 3 with reasoning mode on. ChatML wrapper plus an opening <think> block in the assistant turn.",
      render(system, user) {
        let out = "";
        if (system.trim()) out += `<|im_start|>system\n${system}<|im_end|>\n`;
        out += `<|im_start|>user\n${user}<|im_end|>\n`;
        out += `<|im_start|>assistant\n<think>\n`;
        return out;
      },
      note: "If you skip the opening <think> tag, the model often still reasons — but with worse calibration. The leading tag is part of the contract."
    }
  ];

  function highlightTemplate(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      // <|...|> tokens
      .replace(/(&lt;\|[a-z_]+\|&gt;)/g, '<span class="mte-tok">$1</span>')
      // <<SYS>> / <</SYS>>
      .replace(/(&lt;&lt;\/?[A-Z]+&gt;&gt;)/g, '<span class="mte-tok">$1</span>')
      // <bos>, <eos>, <s>, </s>, <start_of_turn>, <end_of_turn>
      .replace(/(&lt;\/?(?:s|bos|eos|start_of_turn|end_of_turn)&gt;)/g, '<span class="mte-tok">$1</span>')
      // [INST] / [/INST]
      .replace(/(\[\/?INST\])/g, '<span class="mte-tok">$1</span>')
      // <think> / </think>
      .replace(/(&lt;\/?think&gt;)/g, '<span class="mte-think">$1</span>');
  }

  function chatTemplateExplorer(root) {
    let templateId = "llama3";
    let systemText = "You are a helpful assistant.";
    let userText = "Explain KV cache in one sentence.";

    root.innerHTML = `
      <div class="widget-title">Chat template explorer</div>
      <p style="font-size:13px;color:var(--text-dim);margin:0 0 10px;">Pick a model family's chat template. Edit the system and user fields. See the exact string fed to the tokenizer — with every special token highlighted.</p>
      <div class="mte-type-tabs" id="ct-tabs"></div>
      <div class="mte-type-desc" id="ct-desc"></div>
      <div class="ct-inputs">
        <div class="ct-field">
          <label>System message</label>
          <textarea id="ct-system" rows="2"></textarea>
        </div>
        <div class="ct-field">
          <label>User message</label>
          <textarea id="ct-user" rows="2"></textarea>
        </div>
        <div class="ct-actions">
          <button class="preset-btn" id="ct-clearsys">Clear system</button>
          <button class="preset-btn" id="ct-reset">Reset</button>
        </div>
      </div>
      <div class="mte-pane">
        <div class="mte-pane-label">What the tokenizer actually receives</div>
        <div class="mte-box mte-sees" id="ct-output"></div>
      </div>
      <div class="mte-note" id="ct-note"></div>
    `;
    const $ = sel => root.querySelector(sel);

    function renderTabs() {
      const wrap = $("#ct-tabs");
      wrap.innerHTML = "";
      CT_TEMPLATES.forEach(t => {
        wrap.appendChild(el("button", {
          class: "mte-tab" + (t.id === templateId ? " active" : ""),
          onclick: () => { templateId = t.id; paint(); }
        }, [t.label]));
      });
    }

    function paint() {
      renderTabs();
      const t = CT_TEMPLATES.find(x => x.id === templateId);
      $("#ct-system").value = systemText;
      $("#ct-user").value = userText;
      $("#ct-desc").textContent = t.desc;
      const formatted = t.render(systemText, userText);
      $("#ct-output").innerHTML = highlightTemplate(formatted);
      $("#ct-note").textContent = t.note;
    }

    $("#ct-system").addEventListener("input", e => { systemText = e.target.value; paint(); });
    $("#ct-user").addEventListener("input",   e => { userText   = e.target.value; paint(); });
    $("#ct-clearsys").addEventListener("click", () => { systemText = ""; paint(); });
    $("#ct-reset").addEventListener("click", () => {
      systemText = "You are a helpful assistant.";
      userText = "Explain KV cache in one sentence.";
      paint();
    });

    paint();
  }

  // ============================================================
  // 8) SPEED PREDICTOR — first-order tokens/sec model.
  //    Decode is bandwidth-bound: tps ≈ bandwidth / (active_params × bytes_per_param)
  //    Prefill is compute-bound: TTFT ≈ (prompt × 2 × params) / FLOPs
  //    Batching amortizes bandwidth across sequences until compute saturates.
  // ============================================================
  const SP_PRESETS = [
    { name: "RTX 3090 + 7B Q4",
      bw: 936,  flops: 70,   vram: 24,
      total: 7,   active: 7,   quant: "q4",
      prompt: 1000, gen: 200, batch: 1, spec: 1.0 },
    { name: "RTX 4090 + 13B Q4",
      bw: 1008, flops: 165,  vram: 24,
      total: 13,  active: 13,  quant: "q4",
      prompt: 1000, gen: 200, batch: 1, spec: 1.0 },
    { name: "H100 + 70B FP8 / batch 8",
      bw: 3350, flops: 989,  vram: 80,
      total: 70,  active: 70,  quant: "q8",
      prompt: 4000, gen: 500, batch: 8, spec: 1.0 },
    { name: "M3 Max + 7B Q4 (unified)",
      bw: 300,  flops: 35,   vram: 64,
      total: 7,   active: 7,   quant: "q4",
      prompt: 500,  gen: 200, batch: 1, spec: 1.0 },
    { name: "B200 + 671B MoE (37B active)",
      bw: 8000, flops: 2250, vram: 192,
      total: 671, active: 37,  quant: "q8",
      prompt: 2000, gen: 500, batch: 32, spec: 1.0 }
  ];

  const SP_QUANT_BYTES = { fp16: 2, q8: 1, q6: 0.75, q5: 0.625, q4: 0.5, q3: 0.375 };
  const SP_EFFICIENCY = 0.55;        // real-world fraction of theoretical bandwidth
  const SP_COMPUTE_UTIL = 0.50;      // fraction of theoretical FLOPs achieved

  function speedPredictor(root) {
    let state = { ...SP_PRESETS[1] };  // RTX 4090 + 13B Q4

    root.innerHTML = `
      <div class="widget-title">Theoretical speed predictor</div>
      <p style="font-size:13px;color:var(--text-dim);margin:0 0 10px;">First-order model. Tweak any knob and see how decode rate, TTFT, and total request time move. Bottleneck label shows which factor is actually limiting you.</p>
      <div class="presets" id="sp-presets"></div>

      <div class="sp-cols">
        <div class="sp-col">
          <div class="sp-col-title">Hardware</div>
          <div class="widget-row"><label>Memory bandwidth (GB/s)</label><input type="number" id="sp-bw" min="10" max="10000" step="10"></div>
          <div class="widget-row"><label>Compute (TFLOPS BF16)</label><input type="number" id="sp-flops" min="1" max="5000" step="1"></div>
          <div class="widget-row"><label>VRAM (GB)</label><input type="number" id="sp-vram" min="2" max="500" step="1"></div>
        </div>
        <div class="sp-col">
          <div class="sp-col-title">Model</div>
          <div class="widget-row"><label>Total params (B)</label><input type="number" id="sp-total" min="0.1" max="2000" step="0.5"></div>
          <div class="widget-row"><label>Active params (B) — MoE</label><input type="number" id="sp-active" min="0.1" max="2000" step="0.5"></div>
          <div class="widget-row"><label>Quantization</label>
            <select id="sp-quant">
              <option value="fp16">FP16/BF16 (2 b/p)</option>
              <option value="q8">Q8 / INT8 (1 b/p)</option>
              <option value="q6">Q6 (0.75 b/p)</option>
              <option value="q5">Q5 (0.625 b/p)</option>
              <option value="q4">Q4 (0.5 b/p)</option>
              <option value="q3">Q3 (0.375 b/p)</option>
            </select>
          </div>
        </div>
        <div class="sp-col">
          <div class="sp-col-title">Workload</div>
          <div class="widget-row"><label>Prompt tokens</label><input type="number" id="sp-prompt" min="1" max="200000" step="100"></div>
          <div class="widget-row"><label>Generated tokens</label><input type="number" id="sp-gen" min="1" max="10000" step="10"></div>
          <div class="widget-row"><label>Batch size</label><input type="number" id="sp-batch" min="1" max="512" step="1"></div>
          <div class="widget-row"><label>Speculative decoding ×</label><input type="number" id="sp-spec" min="1" max="5" step="0.1"></div>
        </div>
      </div>

      <div class="widget-output" id="sp-out"></div>
      <p style="font-size:12px;color:var(--text-mute);margin-top:10px;">First-order estimate. Real numbers depend on attention implementation (FlashAttention vs naive), KV cache reads, runtime overhead, OS scheduling, and how well the kernels match your hardware. Assumes ${Math.round(SP_EFFICIENCY*100)}% of theoretical bandwidth on decode and ${Math.round(SP_COMPUTE_UTIL*100)}% of peak FLOPs on prefill.</p>
    `;
    const $ = sel => root.querySelector(sel);

    // Preset buttons
    const presets = $("#sp-presets");
    SP_PRESETS.forEach(p => {
      presets.appendChild(el("button", {
        class: "preset-btn",
        onclick: () => { state = { ...p }; syncInputs(); recalc(); }
      }, [p.name]));
    });

    function syncInputs() {
      $("#sp-bw").value     = state.bw;
      $("#sp-flops").value  = state.flops;
      $("#sp-vram").value   = state.vram;
      $("#sp-total").value  = state.total;
      $("#sp-active").value = state.active;
      $("#sp-quant").value  = state.quant;
      $("#sp-prompt").value = state.prompt;
      $("#sp-gen").value    = state.gen;
      $("#sp-batch").value  = state.batch;
      $("#sp-spec").value   = state.spec;
    }

    function readInputs() {
      state.bw     = +$("#sp-bw").value;
      state.flops  = +$("#sp-flops").value;
      state.vram   = +$("#sp-vram").value;
      state.total  = +$("#sp-total").value;
      state.active = +$("#sp-active").value;
      state.quant  = $("#sp-quant").value;
      state.prompt = +$("#sp-prompt").value;
      state.gen    = +$("#sp-gen").value;
      state.batch  = +$("#sp-batch").value;
      state.spec   = +$("#sp-spec").value;
    }

    function fmtMs(seconds) {
      if (seconds < 1) return (seconds * 1000).toFixed(0) + " ms";
      if (seconds < 60) return seconds.toFixed(2) + " s";
      return (seconds / 60).toFixed(2) + " min";
    }

    function recalc() {
      const bpp = SP_QUANT_BYTES[state.quant];

      // Weight memory
      const weightGB = state.total * bpp;
      const activeWeightGB = state.active * bpp;

      // Decode model
      // - Each decode step the GPU streams active weights once (regardless of batch)
      // - Compute cost scales with batch
      const bwTimePerStep = activeWeightGB / state.bw;                                            // sec
      const computeFlopsPerSeqStep = 2 * state.active * 1e9;                                      // FLOPs per token per sequence
      const computeTimePerStep = (state.batch * computeFlopsPerSeqStep) / (state.flops * 1e12 * SP_COMPUTE_UTIL);
      const stepTime = Math.max(bwTimePerStep, computeTimePerStep);

      // Apply efficiency (overhead, KV reads, attention math)
      const perSeqTps = (1 / stepTime) * SP_EFFICIENCY * state.spec;
      const batchThroughput = perSeqTps * state.batch;

      // Prefill (compute-bound). For MoE, per-token FLOPs scale with active
      // parameters (only the routed experts execute per token), not total.
      const prefillFlops = state.prompt * 2 * state.active * 1e9;  // dense forward FLOPs through active path
      const ttftSec = prefillFlops / (state.flops * 1e12 * SP_COMPUTE_UTIL);

      // Per-request total time (single sequence in batch)
      const genTimeSec = state.gen / perSeqTps;
      const totalTimeSec = ttftSec + genTimeSec;

      // Bottleneck
      const bandwidthBound = bwTimePerStep >= computeTimePerStep;
      const bottleneck = bandwidthBound ? "Bandwidth-bound" : "Compute-bound";
      const bottleneckExplain = bandwidthBound
        ? `At batch ${state.batch}, the math (${(computeTimePerStep*1000).toFixed(2)} ms/step) finishes before the weight read does (${activeWeightGB.toFixed(2)} GB at ${state.bw} GB/s = ${(bwTimePerStep*1000).toFixed(2)} ms/step), so compute stalls waiting on memory. More memory bandwidth helps directly. More FLOPs do not — until batch grows enough to flip the balance.`
        : `At batch ${state.batch}, compute is the bottleneck (${(computeTimePerStep*1000).toFixed(2)} ms/step vs ${(bwTimePerStep*1000).toFixed(2)} ms for bandwidth). More FLOPs help, lower batch helps single-sequence latency, higher batch helps throughput.`;

      // Bandwidth saturation batch
      const saturationBatch = Math.max(1, Math.floor(bwTimePerStep / (computeFlopsPerSeqStep / (state.flops * 1e12 * SP_COMPUTE_UTIL))));

      // VRAM check — includes a rough KV cache estimate. The widget does not
      // expose layer / KV-head detail, so this uses a heuristic calibrated to
      // typical 2026 GQA models: ~0.04 MB/token per sqrt(B) of total params at
      // FP16 KV. Approximates Llama-3 8B at ~0.11 MB/tok and Llama 70B at
      // ~0.33 MB/tok. MoE total drives the KV layout, not active.
      const overhead = 1.5; // GB
      const kvBytesPerToken = 40000 * Math.sqrt(state.total);
      const kvCacheGB = state.batch * (state.prompt + state.gen) * kvBytesPerToken / 1e9;
      const totalMem = weightGB + overhead + kvCacheGB;
      const fitsVram = totalMem < state.vram * 0.9;
      const vramRow = `<tr><th>Weight memory</th><td>${weightGB.toFixed(2)} GB ${state.total !== state.active ? `(MoE — ${activeWeightGB.toFixed(2)} GB active per token)` : ""}</td></tr>`;
      const kvRow = `<tr><th>KV cache (approx, FP16)</th><td>${kvCacheGB.toFixed(2)} GB at ${state.prompt}+${state.gen} tokens × batch ${state.batch}</td></tr>`;
      const vramVerdict = fitsVram
        ? ""
        : `<div class="verdict bad">Weights (${weightGB.toFixed(1)} GB) + KV cache (${kvCacheGB.toFixed(1)} GB) + overhead exceeds ~90% of ${state.vram} GB VRAM. Expect CPU spill or OOM at this configuration — reduce context, batch, or model size.</div>`;

      $("#sp-out").innerHTML = `
        <table>
          ${vramRow}
          ${kvRow}
          <tr><th>Decode rate (per sequence)</th><td><strong>${perSeqTps.toFixed(1)} tok/sec</strong></td></tr>
          <tr><th>Batch throughput</th><td>${batchThroughput.toFixed(0)} tok/sec across ${state.batch} sequence${state.batch===1?"":"s"}</td></tr>
          <tr><th>Time to first token</th><td>${fmtMs(ttftSec)} (prefill of ${state.prompt} tokens)</td></tr>
          <tr><th>Generation time</th><td>${fmtMs(genTimeSec)} for ${state.gen} tokens</td></tr>
          <tr><th><strong>Total request time</strong></th><td><strong>${fmtMs(totalTimeSec)}</strong></td></tr>
          ${state.spec > 1 ? `<tr><th>Speculative decoding</th><td>${state.spec.toFixed(1)}× boost applied to decode rate</td></tr>` : ""}
        </table>
        <div class="verdict ${bandwidthBound ? "ok" : "warn"}" style="margin-top:12px;">
          <strong>${bottleneck}.</strong> ${bottleneckExplain}
          ${bandwidthBound && state.batch < saturationBatch ? `<br>Bandwidth holds until ~batch ${saturationBatch}; raising batch beyond that pushes you into compute-bound.` : ""}
        </div>
        ${vramVerdict}
      `;
    }

    root.querySelectorAll("input, select").forEach(i => {
      i.addEventListener("input", () => { readInputs(); recalc(); });
    });

    syncInputs();
    recalc();
  }

  // ============================================================
  // 9) LONG-CONTEXT HABITS EXPLORER — for each practical habit,
  //    show a concrete Don't / Do pair plus the reason it matters.
  // ============================================================
  const LC_HABITS = [
    {
      id: "bookend",
      label: "Bookend instructions",
      desc: "Put critical instructions near the START and again near the END. Models attend best to the beginning and the end of long contexts — the middle is where details get lost.",
      bad: { label: "Don't: instructions buried mid-context",
        text: `[100K tokens of meeting transcripts, codebase, supporting docs, …]

Oh and please summarize this in bullet points and return JSON.` },
      good: { label: "Do: bookend the instructions",
        text: `INSTRUCTIONS:
Summarize the content below in bullet points and return JSON with keys {topic, bullets, action_items}.

[100K tokens of meeting transcripts, codebase, supporting docs, …]

REMINDER: Return the result as JSON with keys {topic, bullets, action_items}. Bullets only — no prose.` },
      why: `Models in 2026 still degrade in the middle of long contexts ("lost in the middle"). Restating the instruction at the bottom catches the model right before it generates.`
    },
    {
      id: "delimiters",
      label: "Headers & delimiters",
      desc: "Wrap each chunk in clear delimiters and label them. The model uses these as anchors when you ask follow-up questions or request citations.",
      bad: { label: "Don't: wall of undifferentiated text",
        text: `The system processes user requests by first authenticating the session token, then routing through the cache layer, then querying the database… Performance metrics for Q3 showed 240ms p99 latency, up from 180ms… The new pricing tier introduces volume discounts at the 10K monthly tier…` },
      good: { label: "Do: structure with headers and IDs",
        text: `<doc id="arch_overview" source="design.md">
# System architecture
The system processes user requests by first authenticating…
</doc>

<doc id="q3_metrics" source="ops_report.pdf">
# Q3 performance metrics
240ms p99 latency, up from 180ms…
</doc>

<doc id="pricing_v2" source="pricing.md">
# Pricing v2
The new pricing tier introduces volume discounts…
</doc>` },
      why: `With doc IDs, the model can cite chunks by name ("see arch_overview") and you can spot when it mixes content from the wrong source.`
    },
    {
      id: "citations",
      label: "Cite chunks",
      desc: "Demand citations tied to specific chunks. Without this, the model invents plausible-sounding claims and you have no way to check.",
      bad: { label: "Don't: ungrounded summary",
        text: `Summarize the documents above.` },
      good: { label: "Do: require chunk-level citations",
        text: `Summarize the documents above. For every claim, cite the source chunk by its id in square brackets, like [arch_overview] or [q3_metrics:p3]. If a claim is not supported by any chunk, do not include it.` },
      why: `Forced citations make hallucination visible — you can grep the output and spot any [made_up_id] that doesn't exist. Without citations, plausible-sounding wrong claims slip through unnoticed.`
    },
    {
      id: "compress",
      label: "Compress history",
      desc: "Don't send the entire chat history verbatim. Summarize older turns; keep only recent turns in full detail.",
      bad: { label: "Don't: send everything ever said",
        text: `[Turn 1] User: Hi
[Turn 1] Assistant: Hello! How can I help?
[Turn 2] User: What's the weather like?
[Turn 2] Assistant: I don't have real-time data.
[Turn 3] User: Oh okay. Let's chat about something else.
… (47 more turns of mostly small talk) …
[Turn 50] User: So given everything we've discussed about my project, what should I do?` },
      good: { label: "Do: summary + recent turns only",
        text: `[CONVERSATION SUMMARY]
Across 50 prior turns, the user discussed their Python web scraper. Key facts: using BeautifulSoup, hitting rate limits on the target site, considered switching to Playwright. User prefers concise answers.

[Turn 48] User: Should I add exponential backoff?
[Turn 48] Assistant: Yes — with jitter, starting at 1s.
[Turn 49] User: How do I add jitter in Python?
[Turn 49] Assistant: [code snippet]
[Turn 50] User: So given everything we've discussed about my project, what should I do?` },
      why: `Long chat history balloons the KV cache (every token in every turn costs memory on every new token). A summary preserves the relevant signal at a fraction of the token cost.`
    },
    {
      id: "summary-memory",
      label: "Summary memory",
      desc: "For long-running chats, periodically compact older history into a summary turn instead of letting it grow forever.",
      bad: { label: "Don't: infinite KV cache",
        text: `// in your chat app
let history = [];
async function send(userMsg) {
  history.push({ role: "user", content: userMsg });
  const reply = await llm(history);   // grows unbounded
  history.push({ role: "assistant", content: reply });
}
// After 200 turns: KV cache exhausts VRAM. App crashes or slows to a crawl.` },
      good: { label: "Do: compaction at a threshold",
        text: `// in your chat app
let history = [];
let summary = "";

async function send(userMsg) {
  history.push({ role: "user", content: userMsg });

  // Compact when history grows too large
  if (totalTokens(history) > 8000) {
    summary = await llm([
      { role: "system", content: "Summarize the conversation so far." },
      ...history.slice(0, -4)
    ]);
    history = history.slice(-4);  // keep the most recent turns verbatim
  }

  const messages = summary
    ? [{ role: "system", content: "Earlier: " + summary }, ...history]
    : history;

  const reply = await llm(messages);
  history.push({ role: "assistant", content: reply });
}` },
      why: `Same pattern Claude Code uses internally — periodic compaction keeps the conversation usable indefinitely without the KV cache exploding.`
    }
  ];

  function longContextHabits(root) {
    let habitId = "bookend";

    root.innerHTML = `
      <div class="widget-title">Long-context habits — Don't / Do</div>
      <p style="font-size:13px;color:var(--text-dim);margin:0 0 10px;">Pick a habit. See the bad version and the good version side by side, with a one-liner on why it matters.</p>
      <div class="mte-type-tabs" id="lc-tabs"></div>
      <div class="mte-type-desc" id="lc-desc"></div>
      <div class="lc-panes">
        <div class="mte-pane lc-pane-bad">
          <div class="mte-pane-label" id="lc-bad-label"></div>
          <div class="mte-box mte-sees" id="lc-bad"></div>
        </div>
        <div class="mte-pane lc-pane-good">
          <div class="mte-pane-label" id="lc-good-label"></div>
          <div class="mte-box mte-sees" id="lc-good"></div>
        </div>
      </div>
      <div class="mte-note" id="lc-note"></div>
    `;
    const $ = sel => root.querySelector(sel);

    function renderTabs() {
      const wrap = $("#lc-tabs");
      wrap.innerHTML = "";
      LC_HABITS.forEach(h => {
        wrap.appendChild(el("button", {
          class: "mte-tab" + (h.id === habitId ? " active" : ""),
          onclick: () => { habitId = h.id; paint(); }
        }, [h.label]));
      });
    }

    function paint() {
      renderTabs();
      const h = LC_HABITS.find(x => x.id === habitId);
      $("#lc-desc").textContent = h.desc;
      $("#lc-bad-label").textContent  = h.bad.label;
      $("#lc-good-label").textContent = h.good.label;
      $("#lc-bad").textContent  = h.bad.text;
      $("#lc-good").textContent = h.good.text;
      $("#lc-note").textContent = h.why;
    }

    paint();
  }

  // ============================================================
  // 10) CHUNKER PLAYGROUND — see how the same text breaks differently
  //     under each strategy. Count sentences split mid-flow.
  // ============================================================
  const CK_DEFAULT_TEXT = `# System architecture

The platform processes user requests in three stages: authentication, routing, and storage. Each stage has its own monitoring.

## Authentication

Sessions use JWT tokens issued by the auth server. Tokens expire after 24 hours and refresh tokens last 30 days.

## Routing

After auth, requests route through a CDN edge node. Cache misses fall through to the origin cluster in us-east-1.

## Storage

The database is partitioned by tenant ID. Writes go to the primary; reads can hit any replica with eventual consistency.`;

  const CK_STRATEGIES = [
    { id: "fixed",         label: "Fixed size, no overlap" },
    { id: "fixed-overlap", label: "Fixed size + overlap" },
    { id: "sentence",      label: "Sentence-based (size cap)" },
    { id: "paragraph",     label: "Paragraph-based" },
    { id: "heading",       label: "Heading-based (markdown)" }
  ];

  function ckChunkFixed(text, size) {
    const out = [];
    for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
    return out;
  }
  function ckChunkFixedOverlap(text, size, overlap) {
    if (overlap >= size) overlap = size - 1;
    const stride = size - overlap;
    const out = [];
    for (let i = 0; i < text.length; i += stride) {
      out.push(text.slice(i, i + size));
      if (i + size >= text.length) break;
    }
    return out;
  }
  function ckChunkSentence(text, size) {
    // Tokenize into sentences (period/!/? followed by whitespace, or trailing piece)
    const sentences = [];
    let buf = "";
    for (let i = 0; i < text.length; i++) {
      buf += text[i];
      if (/[.!?]/.test(text[i]) && (/\s/.test(text[i + 1] || " ") || i === text.length - 1)) {
        sentences.push(buf);
        buf = "";
      }
    }
    if (buf) sentences.push(buf);
    // Greedy fill up to size
    const out = [];
    let cur = "";
    for (const s of sentences) {
      if (cur.length + s.length > size && cur.length > 0) {
        out.push(cur);
        cur = s;
      } else {
        cur += s;
      }
    }
    if (cur) out.push(cur);
    return out;
  }
  function ckChunkParagraph(text) {
    return text.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0);
  }
  function ckChunkHeading(text) {
    const lines = text.split("\n");
    const out = [];
    let cur = [];
    for (const line of lines) {
      if (/^#{1,6}\s/.test(line) && cur.length > 0 && cur.some(l => l.trim())) {
        const joined = cur.join("\n").trim();
        if (joined) out.push(joined);
        cur = [line];
      } else {
        cur.push(line);
      }
    }
    const last = cur.join("\n").trim();
    if (last) out.push(last);
    return out;
  }

  function ckCountSplitSentences(chunks) {
    let split = 0;
    for (let i = 0; i < chunks.length - 1; i++) {
      const trimmed = chunks[i].replace(/\s+$/, "");
      if (!/[.!?]$/.test(trimmed)) split++;
    }
    return split;
  }

  function chunkerDemo(root) {
    let text = CK_DEFAULT_TEXT;
    let strategy = "fixed";
    let chunkSize = 200;
    let overlap = 50;

    root.innerHTML = `
      <div class="widget-title">Chunker playground</div>
      <p style="font-size:13px;color:var(--text-dim);margin:0 0 10px;">Edit the source text and pick a strategy. Watch how the chunks change — and count how many sentences get split mid-flow.</p>
      <div class="widget-row"><label>Strategy</label>
        <select id="ck-strategy">
          ${CK_STRATEGIES.map(s => `<option value="${s.id}">${s.label}</option>`).join("")}
        </select>
      </div>
      <div class="widget-row" id="ck-size-row"><label>Chunk size (chars)</label>
        <div class="with-suffix"><input type="range" id="ck-size" min="50" max="600" step="10"><span class="suffix" id="ck-size-v"></span></div>
      </div>
      <div class="widget-row" id="ck-overlap-row" style="display:none;"><label>Overlap (chars)</label>
        <div class="with-suffix"><input type="range" id="ck-overlap" min="0" max="200" step="10"><span class="suffix" id="ck-overlap-v"></span></div>
      </div>
      <div class="ct-field" style="margin: 10px 0;">
        <label>Source text (edit me)</label>
        <textarea id="ck-text" rows="8"></textarea>
      </div>
      <div class="widget-output" id="ck-stats"></div>
      <div class="chunk-output" id="ck-output" style="margin-top: 12px;"></div>
    `;
    const $ = sel => root.querySelector(sel);

    function showControls() {
      $("#ck-size-row").style.display = (strategy === "paragraph" || strategy === "heading") ? "none" : "";
      $("#ck-overlap-row").style.display = (strategy === "fixed-overlap") ? "" : "none";
    }

    function chunk(text) {
      if (strategy === "fixed")         return ckChunkFixed(text, chunkSize);
      if (strategy === "fixed-overlap") return ckChunkFixedOverlap(text, chunkSize, overlap);
      if (strategy === "sentence")      return ckChunkSentence(text, chunkSize);
      if (strategy === "paragraph")     return ckChunkParagraph(text);
      if (strategy === "heading")       return ckChunkHeading(text);
      return [];
    }

    function recalc() {
      const chunks = chunk(text);
      const sizes = chunks.map(c => c.length);
      const avg = sizes.length ? Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length) : 0;
      const min = sizes.length ? Math.min(...sizes) : 0;
      const max = sizes.length ? Math.max(...sizes) : 0;
      const split = ckCountSplitSentences(chunks);

      let verdict;
      if (strategy === "fixed" && split > 0) {
        verdict = `<div class="verdict warn">${split} sentence${split === 1 ? "" : "s"} got cut mid-flow. Try "fixed + overlap" (overlap preserves context across boundaries) or "sentence-based" (respects sentence ends).</div>`;
      } else if (strategy === "fixed-overlap" && split > 0) {
        verdict = `<div class="verdict warn">Still ${split} sentence-cuts even with overlap. Overlap softens the impact but doesn't eliminate it. Sentence- or heading-based chunking eliminates the cuts.</div>`;
      } else if (strategy === "sentence" && split === 0) {
        verdict = `<div class="verdict ok">Zero sentences split. Each chunk ends cleanly on a sentence boundary.</div>`;
      } else if (strategy === "heading" && chunks.length > 1) {
        verdict = `<div class="verdict ok">Each chunk is one heading-section. Citations like [arch_overview] map cleanly to a chunk.</div>`;
      } else if (strategy === "paragraph") {
        verdict = `<div class="verdict ok">Each chunk is one paragraph. Tiny chunks (top of doc) may be too small for good retrieval — consider merging adjacent small ones.</div>`;
      } else {
        verdict = `<div class="verdict ok">No sentences split.</div>`;
      }

      $("#ck-stats").innerHTML = `
        <table>
          <tr><th>Chunks produced</th><td><strong>${chunks.length}</strong></td></tr>
          <tr><th>Avg size</th><td>${avg} chars (~${Math.round(avg/4)} tokens)</td></tr>
          <tr><th>Min / max</th><td>${min} / ${max} chars</td></tr>
          <tr><th>Sentences cut</th><td>${split === 0 ? "0 ✓" : `${split} ⚠`}</td></tr>
        </table>
        ${verdict}
      `;

      const out = $("#ck-output");
      out.innerHTML = "";
      chunks.forEach((c, i) => {
        const block = el("div", { class: `chunk-block c${i % 3}` });
        block.appendChild(el("div", { class: "chunk-label" }, [`Chunk ${i + 1} · ${c.length} chars`]));
        const content = el("div", { class: "chunk-content" });
        content.textContent = c;
        block.appendChild(content);
        out.appendChild(block);
      });
    }

    // Initial values
    $("#ck-strategy").value = strategy;
    $("#ck-size").value = chunkSize;
    $("#ck-size-v").textContent = chunkSize;
    $("#ck-overlap").value = overlap;
    $("#ck-overlap-v").textContent = overlap;
    $("#ck-text").value = text;

    $("#ck-strategy").addEventListener("change", e => { strategy = e.target.value; showControls(); recalc(); });
    $("#ck-size").addEventListener("input", e => { chunkSize = +e.target.value; $("#ck-size-v").textContent = chunkSize; recalc(); });
    $("#ck-overlap").addEventListener("input", e => { overlap = +e.target.value; $("#ck-overlap-v").textContent = overlap; recalc(); });
    $("#ck-text").addEventListener("input", e => { text = e.target.value; recalc(); });

    showControls();
    recalc();
  }

  // ============================================================
  // 11) CODING HABITS EXPLORER — Don't / Do pairs for local coding
  // ============================================================
  const CODE_HABITS = [
    {
      id: "repo-context",
      label: "Repo context",
      desc: "Send the model the actual files it needs to read. Without them it invents function names and shapes that don't exist in your codebase.",
      bad: { label: "Don't: bare request, no code in context",
        text: `User: Fix the rate-limit bug in my scraper.

(model has no idea what code exists — it will invent file
 names, hallucinate function signatures, and produce a
 patch that compiles but doesn't fit anything.)` },
      good: { label: "Do: bring the relevant files + the failing test",
        text: `User: Fix the rate-limit issue in scraper.py.

# scraper.py
import requests, time

def fetch_pages(urls):
    results = []
    for url in urls:
        r = requests.get(url)         # no retry, no backoff
        results.append(r.text)
        time.sleep(0.5)
    return results

# test_scraper.py — currently failing after ~20 requests
def test_handles_429():
    ...

Return a unified diff for scraper.py only.` },
      why: `Without files in context, the model invents call sites. With them, it can read the real signature, see the actual loop, and patch in the right spot. Repo retrieval is the single biggest lever for a local coding setup.`
    },
    {
      id: "patch-not-prose",
      label: "Patch not prose",
      desc: "Ask for an applyable diff, not an explanation. A patch is unambiguous — you can apply it, inspect it, and run tests against it.",
      bad: { label: "Don't: prose suggestion",
        text: `User: Add jitter to the exponential backoff.

Model: You should add jitter using random.uniform(0,
base_delay * 0.1) and then add it to your sleep time.
Make sure to import random at the top. Also you might
want to consider...

(now YOU have to translate prose into a code change.
 High risk of copy-paste bugs and missed edits.)` },
      good: { label: "Do: ask for a unified diff, no surrounding prose",
        text: `User: Add jitter to the exponential backoff in
fetch_pages. Return a unified diff for scraper.py.
No prose around it.

Model:
--- a/scraper.py
+++ b/scraper.py
@@ -1,6 +1,7 @@
-import requests, time
+import requests, time, random

 def fetch_pages(urls):
     results = []
     for url in urls:
         r = requests.get(url)
         results.append(r.text)
-        time.sleep(0.5)
+        time.sleep(0.5 + random.uniform(0, 0.5))
     return results` },
      why: `Patches integrate with your tools — git apply, your editor, your test runner. Prose lives in chat and dies there.`
    },
    {
      id: "low-temperature",
      label: "Low temperature",
      desc: "Coding doesn't reward variety on the first pass. Use temperature ~0.1. Sample alternatives only when you're intentionally exploring.",
      bad: { label: "Don't: high temperature for fixes",
        text: `// prompt: fix the off-by-one error in this loop
llm({ model: "code-model", temperature: 1.0, prompt: ... })

Call 1: correct minimal fix ✓
Call 2: "creative" rewrite that breaks two other things ✗
Call 3: completely different approach using comprehensions ✗

(you re-run it because something feels off, get a
 different answer each time, lose trust in the loop.)` },
      good: { label: "Do: low temperature for fixes; sample only for ideas",
        text: `// for FIXING bugs and applying edits:
llm({ model: "code-model", temperature: 0.1, prompt: ... })

Call 1: minimal correct fix
Call 2: same minimal correct fix
Call 3: same minimal correct fix

// only when you WANT alternatives (e.g. "show me 3 ways"):
for (let i = 0; i < 3; i++) {
  candidates.push(await llm({ ..., temperature: 0.8 }))
}` },
      why: `Low T isn't more accurate in theory — it's more reproducible in practice, which is what a coding loop actually needs.`
    },
    {
      id: "test-loop",
      label: "Test loop",
      desc: "The model's first attempt has a non-trivial failure rate. Run tests automatically and feed failures back as the next prompt.",
      bad: { label: "Don't: generate once, ship",
        text: `function fixBug(prompt) {
  const patch = llm(prompt);
  apply(patch);
  // commit & push
}

// success rate ≈ whatever the model does on call 1.
// when it's wrong, you find out in code review or prod.` },
      good: { label: "Do: generate → apply → test → retry with failure",
        text: `async function fixBug(prompt, maxAttempts = 3) {
  for (let i = 0; i < maxAttempts; i++) {
    const patch = await llm(prompt);
    apply(patch);
    const result = await runTests();
    if (result.passed) return patch;

    // feed the failure back into the next prompt
    prompt = \`\${prompt}

Last attempt failed:
\${result.failure}

Try again. Return only the diff.\`;
  }
  return null;  // escalate to human
}` },
      why: `Each loop iteration gets the model closer because it can see exactly what broke. This is how good coding agents actually work — fast, cheap, iterative, with a clear "give up" exit.`
    },
    {
      id: "eval-set",
      label: "Eval set",
      desc: "Without measurement, you can't tell whether a new model or prompt is actually better. Build a small eval set of real tasks from your own code.",
      bad: { label: "Don't: vibes-based model picking",
        text: `Old model: "felt fine"
New model: "felt better!"
Decision: switch.

(three weeks later: "wait, why is the bot worse at
 generating SQL now? was it always like that?")` },
      good: { label: "Do: 20 real tasks, scored, compared",
        text: `# eval_coding.py
TASKS = [
  { name: "fix_off_by_one_in_paginator",
    repo_snapshot: "...", failing_tests: [...] },
  { name: "refactor_user_to_dataclass",
    repo_snapshot: "...", failing_tests: [...] },
  { name: "add_type_hints_to_utils",
    repo_snapshot: "...", failing_tests: [...] },
  // … 20 real tasks from YOUR codebase
];

for model of ["qwen3-coder-30b", "deepseek-coder-33b"] {
  let pass = 0;
  for (task of TASKS) {
    const patch = await callModel(model, task);
    if (applyAndTest(patch, task)) pass++;
  }
  console.log(model, pass, "/", TASKS.length);
}` },
      why: `A small eval set of bugs and tasks from YOUR codebase tells you which model wins YOUR work. Generic leaderboards don't predict what happens on your codebase's quirks.`
    }
  ];

  function codingHabits(root) {
    let habitId = "repo-context";

    root.innerHTML = `
      <div class="widget-title">Coding habits — Don't / Do</div>
      <p style="font-size:13px;color:var(--text-dim);margin:0 0 10px;">Pick a habit. See the bad version and the good version side by side, with a one-liner on why it matters.</p>
      <div class="mte-type-tabs" id="ch-tabs"></div>
      <div class="mte-type-desc" id="ch-desc"></div>
      <div class="lc-panes">
        <div class="mte-pane lc-pane-bad">
          <div class="mte-pane-label" id="ch-bad-label"></div>
          <div class="mte-box mte-sees" id="ch-bad"></div>
        </div>
        <div class="mte-pane lc-pane-good">
          <div class="mte-pane-label" id="ch-good-label"></div>
          <div class="mte-box mte-sees" id="ch-good"></div>
        </div>
      </div>
      <div class="mte-note" id="ch-note"></div>
    `;
    const $ = sel => root.querySelector(sel);

    function renderTabs() {
      const wrap = $("#ch-tabs");
      wrap.innerHTML = "";
      CODE_HABITS.forEach(h => {
        wrap.appendChild(el("button", {
          class: "mte-tab" + (h.id === habitId ? " active" : ""),
          onclick: () => { habitId = h.id; paint(); }
        }, [h.label]));
      });
    }

    function paint() {
      renderTabs();
      const h = CODE_HABITS.find(x => x.id === habitId);
      $("#ch-desc").textContent = h.desc;
      $("#ch-bad-label").textContent  = h.bad.label;
      $("#ch-good-label").textContent = h.good.label;
      $("#ch-bad").textContent  = h.bad.text;
      $("#ch-good").textContent = h.good.text;
      $("#ch-note").textContent = h.why;
    }

    paint();
  }

  // ============================================================
  // 12) BANDWIDTH TIERS — 2026 local AI hardware landscape grouped
  //     by memory bandwidth tier with capacity and platform family.
  // ============================================================
  const HW_TIERS = [
    {
      label: "1.8 TB/s class",
      subtitle: "Blackwell discrete GPUs — the bandwidth ceiling",
      max: 1792,
      platforms: [
        { name: "RTX PRO 6000 Blackwell", bw: 1792, cap: 96, family: "NVIDIA dGPU" },
        { name: "RTX 5090",               bw: 1792, cap: 32, family: "NVIDIA dGPU" }
      ]
    },
    {
      label: "800 GB/s – 1 TB/s class",
      subtitle: "Last-gen flagship discrete GPUs + Apple Ultra",
      max: 1792,
      platforms: [
        { name: "RTX 4090",                  bw: 1008, cap: 24,  family: "NVIDIA dGPU" },
        { name: "AMD Radeon RX 7900 XTX",    bw: 960,  cap: 24,  family: "AMD dGPU" },
        { name: "AMD Radeon PRO W7900",      bw: 864,  cap: 48,  family: "AMD dGPU" },
        { name: "Apple Mac Studio M3 Ultra", bw: 819,  cap: 512, family: "Apple unified" }
      ]
    },
    {
      label: "450–650 GB/s class",
      subtitle: "Workstation tier — Apple Max + mid AMD/Intel + Tenstorrent",
      max: 1792,
      platforms: [
        { name: "AMD Radeon AI PRO R9700",   bw: 640, cap: 32,  family: "AMD dGPU" },
        { name: "MacBook Pro M5 Max",        bw: 614, cap: 128, family: "Apple unified" },
        { name: "Intel Arc Pro B65",         bw: 608, cap: 32,  family: "Intel dGPU" },
        { name: "Tenstorrent Wormhole n300", bw: 576, cap: 24,  family: "Tenstorrent" },
        { name: "Mac Studio M4 Max",         bw: 546, cap: 128, family: "Apple unified" },
        { name: "Tenstorrent Blackhole p150",bw: 512, cap: 32,  family: "Tenstorrent" },
        { name: "Intel Arc Pro B60",         bw: 456, cap: 24,  family: "Intel dGPU" }
      ]
    },
    {
      label: "250–300 GB/s unified",
      subtitle: "Coherent unified-memory appliances — capacity over speed",
      max: 1792,
      platforms: [
        { name: "MacBook Pro M5 Pro",        bw: 307, cap: 64,  family: "Apple unified" },
        { name: "NVIDIA DGX Spark",          bw: 273, cap: 128, family: "NVIDIA appliance" },
        { name: "Mac mini M4 Pro",           bw: 273, cap: 64,  family: "Apple unified" },
        { name: "Ryzen AI Max / Strix Halo", bw: 256, cap: 128, family: "AMD unified" }
      ]
    },
    {
      label: "Thin-and-light AI PC",
      subtitle: "Laptops and small desktops — fine for small assistants, not workstation work",
      max: 1792,
      platforms: [
        { name: "Snapdragon X2 Elite Extreme",  bw: 228, cap: 64, family: "ARM AI PC" },
        { name: "Snapdragon X2 Elite",          bw: 152, cap: 64, family: "ARM AI PC" },
        { name: "MacBook Air M5",       bw: 153, cap: 32, family: "Apple unified" },
        { name: "Intel Lunar Lake",     bw: 136, cap: 32, family: "x86 AI PC" },
        { name: "Snapdragon X Elite",   bw: 135, cap: 32, family: "ARM AI PC" },
        { name: "Mac mini M4",          bw: 120, cap: 32, family: "Apple unified" }
      ]
    }
  ];

  function bandwidthTiers(root) {
    const maxBw = 1792;

    let html = `
      <div class="widget-title">2026 local AI hardware — bandwidth tiers</div>
      <p style="font-size:13px;color:var(--text-dim);margin:0 0 14px;">Capacity decides what fits. Bandwidth decides how hard the box can breathe. Same model, same software — bandwidth tier predicts tokens/sec better than any other single number.</p>
    `;

    HW_TIERS.forEach(tier => {
      html += `<div class="hw-tier">
        <div class="hw-tier-head">
          <span class="hw-tier-label">${tier.label}</span>
          <span class="hw-tier-sub">${tier.subtitle}</span>
        </div>
        <table class="hw-tier-table">
          <thead><tr><th>Platform</th><th>Family</th><th>Capacity</th><th class="hw-bw-col">Bandwidth</th></tr></thead>
          <tbody>`;
      tier.platforms.forEach(p => {
        const pct = (p.bw / maxBw) * 100;
        html += `<tr>
          <td class="hw-name">${p.name}</td>
          <td class="hw-family">${p.family}</td>
          <td class="hw-cap">${p.cap} GB</td>
          <td class="hw-bw">
            <div class="hw-bw-track"><div class="hw-bw-fill" style="width:${pct.toFixed(1)}%"></div></div>
            <span class="hw-bw-val">${p.bw} GB/s</span>
          </td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
    });

    root.innerHTML = html;
  }

  // ============================================================
  // 13) ENGINE PICKER — hardware × workload → recommended engine(s)
  // ============================================================
  const EP_HARDWARE = [
    { id: "cpu",        label: "CPU only / edge" },
    { id: "mac",        label: "Apple Silicon Mac" },
    { id: "singleRtx",  label: "Single RTX 3090 / 4090 / 5090" },
    { id: "multiRtx",   label: "Multi-RTX (2–4 consumer GPUs)" },
    { id: "datacenter", label: "Datacenter GPU (H100 / H200 / B200)" },
    { id: "fleet",      label: "Multi-node fleet (production cluster)" },
    { id: "amdIntel",   label: "AMD / Intel discrete GPU" },
    { id: "browser",    label: "Browser / mobile / Windows-native app" }
  ];
  const EP_USECASE = [
    { id: "convenience", label: "Local convenience (one user, chat / coding)" },
    { id: "agent",       label: "Local agent (multi-step, tools)" },
    { id: "team",        label: "Internal team (a few concurrent users)" },
    { id: "scale",       label: "Customer scale (many concurrent users)" },
    { id: "embed",       label: "Edge / app embedding" }
  ];

  // For each (hardware × useCase) cell: primary engine + 1–2 alternatives + reasoning
  const EP_MATRIX = {
    cpu: {
      convenience: { primary: "llama.cpp", alts: ["LM Studio (uses llama.cpp under the hood)"], why: "llama.cpp is the portability king — CPU, ARM, AVX/AVX2/AVX512/AMX, RISC-V, hybrid GPU offload. The one engine that 'just runs' on weird hardware." },
      agent:       { primary: "llama.cpp", alts: ["Harbor (bundled local stack)"], why: "CPU-only agents are slow but workable for short, structured prompts. llama.cpp's HTTP server supports tool calling and JSON schemas." },
      team:        { primary: "llama.cpp", alts: ["escalate to a GPU box"], why: "llama.cpp can serve a small team, but multi-user concurrency on CPU has hard limits. Plan to move to GPU for any real load." },
      scale:       { primary: "(escalate hardware)", alts: ["vLLM / SGLang on GPU", "TGI on a managed host"], why: "Customer-scale serving on CPU isn't realistic. Move to a GPU runtime." },
      embed:       { primary: "ONNX Runtime GenAI", alts: ["llama.cpp", "OpenVINO GenAI (Intel)"], why: "ONNX Runtime is the standardized cross-hardware path. OpenVINO if you're on Intel Xeon / Arc / Core Ultra." }
    },
    mac: {
      convenience: { primary: "MLX / MLX-LM", alts: ["llama.cpp (GGUF / portability)", "LM Studio (uses both)"], why: "MLX is Apple's array framework built around unified memory — CPU and GPU share the same pool, so big quantized models that wouldn't fit a 24 GB consumer GPU often fit on a Mac." },
      agent:       { primary: "MLX-LM", alts: ["llama.cpp"], why: "Mac-native agent loop. MLX-LM has Hugging Face Hub integration, quantization, and LoRA built in. The MLX-LM server is convenient but warns against production use." },
      team:        { primary: "MLX-LM (small team)", alts: ["llama.cpp", "consider moving off Mac for larger teams"], why: "Apple Silicon's bandwidth (~270–820 GB/s) is good but below H100 HBM (~3.35 TB/s). Fine for solo/small-team workflows; not designed for high-concurrency public serving." },
      scale:       { primary: "(move off Mac to a GPU box)", alts: ["vLLM / SGLang on NVIDIA"], why: "Apple is a capacity superpower, not a throughput one. Customer-scale serving belongs on HBM-class hardware." },
      embed:       { primary: "MLX-LM (Mac apps)", alts: ["MLC LLM (cross-platform)"], why: "Native Mac apps embed MLX directly. For iOS, MLC LLM compiles to mobile targets." }
    },
    singleRtx: {
      convenience: { primary: "ExLlamaV2", alts: ["llama.cpp", "LM Studio"], why: "ExLlamaV2 is the consumer CUDA enthusiast's choice — EXL2 quantization, paged attention, prompt caching, KV dedup, speculative decoding. Designed to make 3090/4090/5090-class cards punch above their weight." },
      agent:       { primary: "ExLlamaV2 / vLLM", alts: ["llama.cpp"], why: "ExLlamaV2 for raw single-user latency; vLLM if you want the proper API surface and may scale to multiple agents later." },
      team:        { primary: "vLLM", alts: ["SGLang"], why: "Once multiple users hit the same box, you want continuous batching, paged attention, and a real scheduler. vLLM is the default open-source production server." },
      scale:       { primary: "vLLM (scale up)", alts: ["SGLang", "move to datacenter GPU"], why: "A single consumer GPU has ceiling at ~10–30 concurrent users depending on model and traffic shape. Scale up to multi-GPU or datacenter when you hit the wall." },
      embed:       { primary: "ONNX Runtime GenAI", alts: ["llama.cpp"], why: "App embedding wants a portable runtime, not a server. ONNX Runtime gives you CUDA + DirectML + TensorRT paths in one binary." }
    },
    multiRtx: {
      convenience: { primary: "ExLlamaV3", alts: ["llama.cpp (layer-split multi-GPU)", "vLLM"], why: "ExLlamaV3 extends V2 with tensor-parallel and expert-parallel inference for consumer multi-GPU, EXL3 quantization, and OpenAI-compatible serving via TabbyAPI. Check model compatibility before committing — TP/EP coverage varies by family, and some recent architectures (Qwen3-Next, Qwen3.5, Gemma4) are documented as having rougher edges. llama.cpp does support multi-GPU through --split-mode (layer-split is the default) and --tensor-split, but is less optimized than ExLlamaV3 or vLLM for consumer-grade multi-GPU serving." },
      agent:       { primary: "ExLlamaV3 / vLLM", alts: ["SGLang"], why: "Multi-GPU agents benefit from real parallelism. ExLlamaV3 for local MoE; vLLM/SGLang when behaviour under concurrent agents matters." },
      team:        { primary: "vLLM", alts: ["SGLang"], why: "Continuous batching across multiple GPUs is exactly what vLLM is built for. Without NVLink, vLLM docs note pipeline parallelism may beat tensor parallelism." },
      scale:       { primary: "vLLM or SGLang", alts: ["benchmark TensorRT-LLM"], why: "Multi-RTX scale serving wants a real engine. SGLang for structured outputs, long context, MoE, or routing." },
      embed:       { primary: "n/a", alts: ["use a server, not multi-GPU local embedding"], why: "Multi-GPU is a serving topology, not an embedding one." }
    },
    datacenter: {
      convenience: { primary: "vLLM", alts: ["SGLang", "TensorRT-LLM"], why: "Even for one user, a datacenter GPU lets you run larger models faster. vLLM is the right starting point." },
      agent:       { primary: "vLLM / SGLang", alts: ["TensorRT-LLM"], why: "Single-agent latency benefits from speculative decoding and prefix caching, both supported." },
      team:        { primary: "vLLM or SGLang", alts: ["TGI for HF integration"], why: "Real internal-team serving. Continuous batching, paged attention, structured outputs — all standard here." },
      scale:       { primary: "Benchmark vLLM, SGLang, TensorRT-LLM", alts: ["LMDeploy"], why: "Customer scale is a bake-off. TensorRT-LLM for max NVIDIA performance (FP8/FP4 on H100/B200); SGLang for prefill-decode disaggregation and complex routing; vLLM for flexibility." },
      embed:       { primary: "n/a", alts: ["use a serving stack, not embedding"], why: "Datacenter GPUs serve apps; they don't ship inside them." }
    },
    fleet: {
      convenience: { primary: "n/a", alts: ["use a single-node setup for one user"], why: "Fleet topology for one user is overkill." },
      agent:       { primary: "n/a", alts: ["single-node engine"], why: "Fleet for an agent is overkill unless the agent IS the product at scale." },
      team:        { primary: "vLLM/SGLang + NVIDIA Dynamo", alts: ["TensorRT-LLM + Dynamo"], why: "Dynamo is the orchestration layer above engines — disaggregated prefill/decode, intelligent routing, multi-tier KV caching, autoscaling. Pairs with vLLM, SGLang, or TensorRT-LLM." },
      scale:       { primary: "TensorRT-LLM + Dynamo", alts: ["SGLang + Dynamo"], why: "On B200/GB200/GB300-class infrastructure, TensorRT-LLM is the max-performance stack. Dynamo handles the fleet layer." },
      embed:       { primary: "n/a", alts: ["—"], why: "Fleet serving doesn't embed." }
    },
    amdIntel: {
      convenience: { primary: "llama.cpp", alts: ["vLLM on ROCm (AMD)", "OpenVINO GenAI (Intel)"], why: "llama.cpp's Vulkan + HIP + SYCL backends are the most portable starting point. For Intel-specific kernels, OpenVINO GenAI." },
      agent:       { primary: "llama.cpp", alts: ["vLLM on ROCm", "OpenVINO GenAI"], why: "Same as convenience but with HTTP server for tool calls." },
      team:        { primary: "vLLM on ROCm (AMD MI300+)", alts: ["SGLang"], why: "AMD MI300/MI325/MI350/MI355 increasingly viable for serving with vLLM/SGLang on ROCm. Don't assume NVIDIA benchmarks transfer." },
      scale:       { primary: "vLLM / SGLang on ROCm", alts: ["LMDeploy"], why: "Production AMD serving has matured. Benchmark on your actual workload." },
      embed:       { primary: "OpenVINO GenAI (Intel)", alts: ["ONNX Runtime GenAI"], why: "OpenVINO targets Xeon CPUs, Arc GPUs, Core Ultra, NPUs natively." }
    },
    browser: {
      convenience: { primary: "WebLLM (MLC LLM)", alts: ["ONNX Runtime GenAI"], why: "WebLLM runs models in WebGPU directly. ONNX Runtime GenAI for Windows-native apps and WebGPU embedding." },
      agent:       { primary: "MLC LLM", alts: ["WebLLM"], why: "Same as convenience — browser-side agents are practical for small models." },
      team:        { primary: "n/a", alts: ["use a server, not browser-side serving"], why: "Browser inference is per-client; team serving is server-side." },
      scale:       { primary: "n/a", alts: ["—"], why: "Doesn't apply." },
      embed:       { primary: "MLC LLM / WebLLM", alts: ["ONNX Runtime GenAI"], why: "Compiler-first universal deployment. Best for ship-everywhere apps." }
    }
  };

  function enginePicker(root) {
    let hwId = "singleRtx";
    let useId = "convenience";

    root.innerHTML = `
      <div class="widget-title">Engine picker — which inference engine fits your setup?</div>
      <p style="font-size:13px;color:var(--text-dim);margin:0 0 12px;">Pick your hardware and your workload pattern. See the recommended engine with one-line reasoning, plus alternatives worth considering.</p>
      <div class="ep-row">
        <div class="ep-col">
          <div class="ep-col-title">Hardware</div>
          <div class="ep-options" id="ep-hw"></div>
        </div>
        <div class="ep-col">
          <div class="ep-col-title">Workload</div>
          <div class="ep-options" id="ep-use"></div>
        </div>
      </div>
      <div class="ep-result" id="ep-result"></div>
    `;
    const $ = sel => root.querySelector(sel);

    function paintOptions() {
      $("#ep-hw").innerHTML = "";
      EP_HARDWARE.forEach(h => {
        const b = el("button", {
          class: "ep-opt" + (h.id === hwId ? " selected" : ""),
          onclick: () => { hwId = h.id; paint(); }
        }, [h.label]);
        $("#ep-hw").appendChild(b);
      });
      $("#ep-use").innerHTML = "";
      EP_USECASE.forEach(u => {
        const b = el("button", {
          class: "ep-opt" + (u.id === useId ? " selected" : ""),
          onclick: () => { useId = u.id; paint(); }
        }, [u.label]);
        $("#ep-use").appendChild(b);
      });
    }

    function paint() {
      paintOptions();
      const cell = (EP_MATRIX[hwId] && EP_MATRIX[hwId][useId]) || null;
      if (!cell) { $("#ep-result").innerHTML = ""; return; }
      const altsHtml = (cell.alts && cell.alts.length)
        ? `<div class="ep-alts"><span class="ep-alts-label">Alternatives:</span> ${cell.alts.map(a => `<span class="ep-alt">${a}</span>`).join("")}</div>`
        : "";
      $("#ep-result").innerHTML = `
        <div class="ep-primary">
          <span class="ep-primary-label">Primary recommendation</span>
          <span class="ep-primary-value">${cell.primary}</span>
        </div>
        <div class="ep-why">${cell.why}</div>
        ${altsHtml}
      `;
    }

    paint();
  }

  // ============================================================
  // 14) Inference time predictor — mounted in m1l1.
  //     Teaches the linear cost of the inference loop: output
  //     tokens divided by decode rate equals generation time.
  //     Prefill (time before the first token) is deliberately
  //     out of scope here; covered in m1l6.
  // ============================================================
  const ITP_PRESETS = [
    { name: "Laptop CPU (8B Q4)",         tps: 5  },
    { name: "Mid GPU / RTX 4070 (8B Q4)", tps: 50 },
    { name: "Apple M4 Max (8B Q4)",       tps: 40 },
    { name: "RTX 4090 (8B Q4)",           tps: 80 },
    { name: "DGX Spark (8B Q4)",          tps: 30 }
  ];

  function inferenceTimePredictor(root) {
    root.innerHTML = `
      <div class="widget-title">Inference time predictor</div>
      <p style="font-size:13px;color:var(--text-dim);margin:0 0 12px;">The inference loop runs once per output token, so total generation time is approximately output tokens divided by the decode rate. Adjust the values below to see the relationship. Prefill time — the latency before the first token appears — is a separate cost covered in a later lesson.</p>
      <div class="presets" id="itp-presets"></div>
      <div class="widget-row"><label>Output tokens</label><input type="number" id="itp-out" value="200" min="1" max="5000"></div>
      <div class="widget-row"><label>Decode rate (tokens/sec)</label><input type="number" id="itp-tps" value="30" min="1" max="500" step="1"></div>
      <div class="widget-output" id="itp-result"></div>
    `;
    const $ = sel => root.querySelector(sel);

    const presets = $("#itp-presets");
    ITP_PRESETS.forEach(p => {
      const btn = el("button", { class: "preset-btn", onclick: () => {
        $("#itp-tps").value = p.tps;
        recalc();
      }}, [p.name]);
      presets.appendChild(btn);
    });

    function fmtTime(seconds) {
      if (seconds < 1) return (seconds * 1000).toFixed(0) + " ms";
      if (seconds < 60) return seconds.toFixed(1) + " s";
      const m = Math.floor(seconds / 60);
      const s = Math.round(seconds % 60);
      return `${m}m ${s}s`;
    }

    function recalc() {
      const outTokens = +$("#itp-out").value || 0;
      const tps = +$("#itp-tps").value || 1;
      const seconds = outTokens / tps;
      const msPerToken = 1000 / tps;
      $("#itp-result").innerHTML = `
        <table>
          <tr><th>Estimated time</th><td><strong>${fmtTime(seconds)}</strong></td></tr>
          <tr><th>Per token</th><td>${msPerToken.toFixed(0)} ms</td></tr>
          <tr><th>Formula</th><td style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;">${outTokens} tokens ÷ ${tps} tokens/sec</td></tr>
        </table>
        <p style="font-size:12.5px;color:var(--text-mute);margin-top:10px;">The relationship is linear: doubling the output length doubles the generation time. This is why short answers feel responsive and long answers feel slow, regardless of how complex the underlying question is.</p>
      `;
    }

    root.querySelectorAll("input").forEach(i => i.addEventListener("input", recalc));
    recalc();
  }

  return { tokenizer, kvCacheCalc, vramCalc, decodingPlayground, quantizationTable, modelTypeExplorer, chatTemplateExplorer, speedPredictor, longContextHabits, chunkerDemo, codingHabits, bandwidthTiers, enginePicker, inferenceTimePredictor };
})();
