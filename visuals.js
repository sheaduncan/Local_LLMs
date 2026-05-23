// Inline SVG diagrams embedded in lessons. Each export is a mount function:
// fn(rootElement) — it fills rootElement with an SVG plus a short caption.
//
// All visuals use CSS variables (var(--accent), var(--text), …) so they
// inherit the site's theme without per-diagram colors.

window.VISUALS = (function () {

  function wrap(root, captionHtml, svg) {
    root.innerHTML =
      `<div class="visual-title">Diagram</div>` +
      svg +
      (captionHtml ? `<div class="visual-caption">${captionHtml}</div>` : "");
  }

  // ============================================================
  // 1) Attention: MHA vs GQA vs MQA
  // ============================================================
  // Three side-by-side panels. Top row: 8 query heads. Bottom row: 8 / 2 / 1
  // K/V heads. Arrows show which Q's share which K/V.
  function attentionVariants(root) {
    const W = 720, H = 320;
    const Q_COUNT = 8;
    const PANEL_W = 220;
    const PANEL_GAP = 30;
    const startX = (W - (3 * PANEL_W + 2 * PANEL_GAP)) / 2;

    const Q_Y = 70, Q_H = 26;
    const KV_Y = 200, KV_H = 36;

    function panel(xOffset, name, kvCount, cacheLabel) {
      const left = startX + xOffset;
      const innerW = PANEL_W;
      const qSlot = innerW / Q_COUNT;
      const qW = qSlot * 0.78;

      // Q boxes
      let qs = "";
      const qCenters = [];
      for (let i = 0; i < Q_COUNT; i++) {
        const cx = left + (i + 0.5) * qSlot;
        qCenters.push(cx);
        qs += `<rect x="${cx - qW/2}" y="${Q_Y}" width="${qW}" height="${Q_H}" rx="3" class="v-q"/>`;
        qs += `<text x="${cx}" y="${Q_Y + Q_H/2 + 4}" class="v-q-label">Q${i+1}</text>`;
      }

      // KV boxes — K and V stacked on two lines so labels fit inside narrow MHA boxes
      let kvs = "";
      const kvCenters = [];
      const kvSlot = innerW / kvCount;
      const kvW = (kvCount === 1) ? innerW * 0.55 : kvSlot * 0.82;
      for (let i = 0; i < kvCount; i++) {
        const cx = left + (i + 0.5) * kvSlot;
        kvCenters.push(cx);
        kvs += `<rect x="${cx - kvW/2}" y="${KV_Y}" width="${kvW}" height="${KV_H}" rx="4" class="v-kv"/>`;
        kvs += `<text x="${cx}" y="${KV_Y + 14}" class="v-kv-label">K${i+1}</text>`;
        kvs += `<text x="${cx}" y="${KV_Y + 28}" class="v-kv-label">V${i+1}</text>`;
      }

      // Arrows: each Q connects to its assigned KV
      let arrows = "";
      const perKV = Q_COUNT / kvCount;
      for (let i = 0; i < Q_COUNT; i++) {
        const kvIdx = Math.floor(i / perKV);
        const x1 = qCenters[i], y1 = Q_Y + Q_H;
        const x2 = kvCenters[kvIdx], y2 = KV_Y;
        arrows += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="v-arrow"/>`;
      }

      return `
        <g>
          <text x="${left + innerW/2}" y="32" class="v-panel-title">${name}</text>
          <text x="${left + innerW/2}" y="50" class="v-panel-sub">${cacheLabel}</text>
          ${arrows}
          ${qs}
          ${kvs}
          <text x="${left + innerW/2}" y="${KV_Y + KV_H + 22}" class="v-axis">${kvCount === 8 ? "8 K/V pairs" : kvCount === 2 ? "2 K/V pairs (shared)" : "1 K/V pair (shared)"}</text>
        </g>
      `;
    }

    const svg = `<svg viewBox="0 0 ${W} ${H}" class="vis" preserveAspectRatio="xMidYMid meet">
      <text x="${startX - 10}" y="${Q_Y + 18}" class="v-rowlabel" text-anchor="end">Queries →</text>
      <text x="${startX - 10}" y="${KV_Y + 22}" class="v-rowlabel" text-anchor="end">K / V →</text>
      ${panel(0,                          "MHA — Multi-Head",     8, "biggest KV cache")}
      ${panel(PANEL_W + PANEL_GAP,        "GQA — Grouped-Query",  2, "moderate KV cache")}
      ${panel(2 * (PANEL_W + PANEL_GAP),  "MQA — Multi-Query",    1, "smallest KV cache")}
    </svg>`;

    wrap(root, "Each Q head holds its own copy of K and V in MHA, which produces the largest KV cache. In GQA, groups of Q heads share K/V — substantially smaller cache for comparable quality. In MQA, all Q heads share a single K/V — the smallest cache, sometimes with a measurable quality cost.", svg);
  }

  // ============================================================
  // 2) The inference loop
  // ============================================================
  function inferenceLoop(root) {
    const W = 720, H = 240;
    const boxes = [
      { label: "Sequence",    sub: "prompt + so-far"      },
      { label: "Model",       sub: "forward pass"          },
      { label: "Logits",      sub: "raw scores"            },
      { label: "Softmax",     sub: "→ probabilities"       },
      { label: "Decoding",    sub: "pick one token"        },
      { label: "Next token",  sub: "append to sequence"    }
    ];
    const N = boxes.length;
    const margin = 30;
    const slot = (W - margin * 2) / N;
    const boxW = slot * 0.82;
    const boxH = 60;
    const boxY = (H - boxH) / 2 - 20;

    let rects = "", arrows = "";
    const centers = [];
    for (let i = 0; i < N; i++) {
      const cx = margin + (i + 0.5) * slot;
      centers.push(cx);
      rects += `<rect x="${cx - boxW/2}" y="${boxY}" width="${boxW}" height="${boxH}" rx="6" class="v-step"/>`;
      rects += `<text x="${cx}" y="${boxY + 24}" class="v-step-label">${boxes[i].label}</text>`;
      rects += `<text x="${cx}" y="${boxY + 44}" class="v-step-sub">${boxes[i].sub}</text>`;
      if (i < N - 1) {
        const x1 = cx + boxW/2, x2 = centers[i] + slot - boxW/2;
        const y = boxY + boxH/2;
        arrows += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="v-arrow"/>`;
      }
    }

    // Loopback arrow: from last box, down and around to first box
    const last = centers[N - 1], first = centers[0];
    const loopY = boxY + boxH + 50;
    arrows += `<path d="M ${last} ${boxY + boxH} L ${last} ${loopY} L ${first} ${loopY} L ${first} ${boxY + boxH}" class="v-arrow v-loop"/>`;
    arrows += `<text x="${(first + last)/2}" y="${loopY + 18}" class="v-axis">…and repeat, until EOS / token limit / user stops</text>`;

    const svg = `<svg viewBox="0 0 ${W} ${H}" class="vis" preserveAspectRatio="xMidYMid meet">
      ${arrows}
      ${rects}
    </svg>`;

    wrap(root, "Inference is a loop. Each pass produces exactly one new token; that token gets appended to the sequence and the loop runs again. \"Tokens per second\" measures how fast this loop completes.", svg);
  }

  // ============================================================
  // 3) Transformer layer stack
  // ============================================================
  function transformerStack(root) {
    const W = 720, H = 410;
    const cx = W / 2;
    const colW = 360;
    const x = cx - colW / 2;

    // Vertical sequence: Tokens → Embedding → [Layer × N] → Output projection → Logits
    // The middle "[Layer × N]" block shows one expanded layer with internal structure.
    const stackY = 30;
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="vis" preserveAspectRatio="xMidYMid meet">`;

    // 1. Tokens
    svg += rectLabel(x, stackY, colW, 38, "Token IDs", "[12, 528, 89, 4, …]", "v-input");
    svg += downArrow(cx, stackY + 38, stackY + 58);

    // 2. Embedding
    svg += rectLabel(x, stackY + 58, colW, 36, "Embedding", "lookup: ID → vector", "v-step");
    svg += downArrow(cx, stackY + 94, stackY + 114);

    // 3. Layer block (expanded internal structure)
    const layerY = stackY + 114;
    const layerH = 130;
    svg += `<rect x="${x}" y="${layerY}" width="${colW}" height="${layerH}" rx="8" class="v-layer-stack"/>`;
    svg += `<text x="${cx}" y="${layerY + 20}" class="v-step-label">Transformer block × N</text>`;

    // Inside: Attention + residual, then MLP + residual
    const innerX = x + 16, innerY = layerY + 32;
    const sub1H = 36;
    svg += `<rect x="${innerX}" y="${innerY}" width="${colW - 32}" height="${sub1H}" rx="4" class="v-inner"/>`;
    svg += `<text x="${cx}" y="${innerY + sub1H/2 + 5}" class="v-step-sub">Self-Attention  +  residual  +  LayerNorm</text>`;
    svg += downArrow(cx, innerY + sub1H, innerY + sub1H + 10);
    const sub2Y = innerY + sub1H + 10;
    svg += `<rect x="${innerX}" y="${sub2Y}" width="${colW - 32}" height="${sub1H}" rx="4" class="v-inner"/>`;
    svg += `<text x="${cx}" y="${sub2Y + sub1H/2 + 5}" class="v-step-sub">MLP  +  residual  +  LayerNorm</text>`;

    // Residual loop arrows (curved around the block, on the right)
    const rx = x + colW + 8;
    svg += `<path d="M ${rx} ${layerY + 8} L ${rx + 18} ${layerY + 8} L ${rx + 18} ${layerY + layerH - 8} L ${rx} ${layerY + layerH - 8}" class="v-residual"/>`;
    svg += `<text x="${rx + 24}" y="${layerY + layerH/2 + 5}" class="v-axis" text-anchor="start">stack ×N times</text>`;

    svg += downArrow(cx, layerY + layerH, layerY + layerH + 20);

    // 4. Output projection
    const opY = layerY + layerH + 20;
    svg += rectLabel(x, opY, colW, 36, "Output projection", "hidden state → one score per vocab token", "v-step");
    svg += downArrow(cx, opY + 36, opY + 56);

    // 5. Logits
    svg += rectLabel(x, opY + 56, colW, 36, "Logits", "raw scores → softmax → probabilities", "v-output");

    svg += `</svg>`;
    wrap(root, "A Transformer is built by stacking the same block repeatedly — typically dozens of layers, sometimes hundreds. Each block performs two operations: self-attention, which lets each token incorporate information from prior tokens, and an MLP, which transforms each token's representation independently. Residual connections allow information from earlier layers to pass through to later ones unchanged.", svg);

    function rectLabel(x, y, w, h, label, sub, cls) {
      const cx = x + w/2;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" class="${cls}"/>` +
             `<text x="${cx}" y="${y + (sub ? 16 : h/2 + 5)}" class="v-step-label">${label}</text>` +
             (sub ? `<text x="${cx}" y="${y + 30}" class="v-step-sub">${sub}</text>` : "");
    }
    function downArrow(cx, y1, y2) {
      return `<line x1="${cx}" y1="${y1}" x2="${cx}" y2="${y2 - 6}" class="v-arrow"/>` +
             `<polygon points="${cx - 4},${y2 - 6} ${cx + 4},${y2 - 6} ${cx},${y2}" class="v-arrow-head"/>`;
    }
  }

  // ============================================================
  // 4) Prefill vs decode timeline
  // ============================================================
  function prefillDecode(root) {
    const W = 720, H = 280;
    const timelineY = H - 50;
    const margin = 30;
    const tlStart = margin + 90;     // leave room for row labels on left
    const tlEnd = W - margin;
    const tlW = tlEnd - tlStart;

    // Allocate widths along the timeline
    const prefillFrac = 0.42;     // prefill takes a chunk
    const decodeStart = tlStart + tlW * prefillFrac;
    const decodeW = tlEnd - decodeStart;
    const decodeTokens = 8;
    const decW = decodeW / decodeTokens;

    let svg = `<svg viewBox="0 0 ${W} ${H}" class="vis" preserveAspectRatio="xMidYMid meet">`;

    // Title strip
    svg += `<text x="${W/2}" y="22" class="v-step-label" style="font-size:13.5px;">Time to process a prompt and generate an answer</text>`;

    // Row 1: prompt tokens visualization (above prefill)
    const promptY = 50;
    svg += `<text x="${tlStart - 10}" y="${promptY + 12}" class="v-rowlabel" text-anchor="end">Prompt</text>`;
    for (let i = 0; i < 18; i++) {
      const cw = (tlW * prefillFrac - 4) / 18;
      svg += `<rect x="${tlStart + i * cw + 1}" y="${promptY}" width="${cw - 2}" height="18" rx="2" class="v-q"/>`;
    }
    svg += `<text x="${tlStart + tlW * prefillFrac / 2}" y="${promptY + 36}" class="v-axis">N prompt tokens (given upfront)</text>`;

    // Prefill block
    const prefillY = 105;
    const prefillH = 50;
    svg += `<text x="${tlStart - 10}" y="${prefillY + prefillH/2 + 5}" class="v-rowlabel" text-anchor="end">Prefill</text>`;
    svg += `<rect x="${tlStart}" y="${prefillY}" width="${tlW * prefillFrac}" height="${prefillH}" rx="6" class="v-prefill"/>`;
    svg += `<text x="${tlStart + tlW * prefillFrac / 2}" y="${prefillY + prefillH/2 - 2}" class="v-step-label">Process all N tokens in parallel</text>`;
    svg += `<text x="${tlStart + tlW * prefillFrac / 2}" y="${prefillY + prefillH/2 + 16}" class="v-step-sub">GPU-friendly, but still costs time</text>`;

    // First-token marker
    svg += `<line x1="${decodeStart}" y1="${prefillY - 10}" x2="${decodeStart}" y2="${prefillY + prefillH + 60}" class="v-marker"/>`;
    svg += `<text x="${decodeStart + 4}" y="${prefillY - 14}" class="v-marker-label">first token here ↓</text>`;

    // Decode blocks
    const decodeY = 175;
    const decH = 50;
    svg += `<text x="${tlStart - 10}" y="${decodeY + decH/2 + 5}" class="v-rowlabel" text-anchor="end">Decode</text>`;
    for (let i = 0; i < decodeTokens; i++) {
      const dx = decodeStart + i * decW;
      svg += `<rect x="${dx + 2}" y="${decodeY}" width="${decW - 4}" height="${decH}" rx="4" class="v-decode"/>`;
      svg += `<text x="${dx + decW/2}" y="${decodeY + decH/2 + 5}" class="v-step-sub">t${i+1}</text>`;
    }
    svg += `<text x="${decodeStart + decodeW/2}" y="${decodeY + decH + 18}" class="v-axis">one token at a time (sequential)</text>`;

    // Timeline arrow
    svg += `<line x1="${tlStart}" y1="${timelineY + 15}" x2="${tlEnd}" y2="${timelineY + 15}" class="v-axis-line"/>`;
    svg += `<polygon points="${tlEnd},${timelineY + 15} ${tlEnd - 6},${timelineY + 11} ${tlEnd - 6},${timelineY + 19}" class="v-arrow-head"/>`;
    svg += `<text x="${tlEnd}" y="${timelineY + 32}" class="v-axis" text-anchor="end">time →</text>`;

    svg += `</svg>`;
    wrap(root, "Prefill processes the entire prompt in a single batched pass — compute-intensive but parallelizable across the input tokens. Decode produces tokens one at a time, with each token's computation depending on the prior token. Long inputs increase the wait before the first output token (time to first token, TTFT); long outputs determine the streaming rate thereafter.", svg);
  }

  // ============================================================
  // 5) RAG vs LLM-only — one user question, two paths
  // ============================================================
  function ragVsLlmOnly(root) {
    const W = 720, H = 510;
    const cx = W / 2;
    const leftCx = 180, leftW = 220;
    const rightCx = 540, rightW = 260;

    function step(cx, y, w, h, label, sub, cls) {
      const x = cx - w / 2;
      let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" class="${cls}"/>`;
      out += `<text x="${cx}" y="${y + (sub ? 22 : h/2 + 5)}" class="v-step-label">${label}</text>`;
      if (sub) out += `<text x="${cx}" y="${y + 42}" class="v-step-sub">${sub}</text>`;
      return out;
    }
    function arrow(cx, y1, y2) {
      return `<line x1="${cx}" y1="${y1}" x2="${cx}" y2="${y2 - 6}" class="v-arrow"/>` +
             `<polygon points="${cx-4},${y2-6} ${cx+4},${y2-6} ${cx},${y2}" class="v-arrow-head"/>`;
    }

    let svg = `<svg viewBox="0 0 ${W} ${H}" class="vis" preserveAspectRatio="xMidYMid meet">`;

    // ----- Shared input at the top -----
    const topY = 25, topW = 240, topH = 40;
    svg += `<rect x="${cx - topW/2}" y="${topY}" width="${topW}" height="${topH}" rx="6" class="v-input"/>`;
    svg += `<text x="${cx}" y="${topY + topH/2 + 5}" class="v-step-label">User question</text>`;

    // Branching arrows from center to each column
    const branchStartY = topY + topH;
    const branchEndY = 110;
    svg += `<line x1="${cx}" y1="${branchStartY}" x2="${leftCx}" y2="${branchEndY - 6}" class="v-arrow"/>`;
    svg += `<line x1="${cx}" y1="${branchStartY}" x2="${rightCx}" y2="${branchEndY - 6}" class="v-arrow"/>`;
    svg += `<polygon points="${leftCx-4},${branchEndY-6} ${leftCx+4},${branchEndY-6} ${leftCx},${branchEndY}" class="v-arrow-head"/>`;
    svg += `<polygon points="${rightCx-4},${branchEndY-6} ${rightCx+4},${branchEndY-6} ${rightCx},${branchEndY}" class="v-arrow-head"/>`;

    // Column labels
    svg += `<text x="${leftCx}" y="100" class="v-panel-title">LLM only</text>`;
    svg += `<text x="${rightCx}" y="100" class="v-panel-title">RAG</text>`;

    // ----- LEFT: LLM ONLY -----
    svg += step(leftCx, 120, leftW, 60, "LLM weights", "trained knowledge only", "v-step");
    svg += arrow(leftCx, 180, 215);
    svg += step(leftCx, 215, leftW, 40, "Answer", null, "v-output");

    // Warning notes
    const warnY = 285;
    svg += `<text x="${leftCx}" y="${warnY}"      class="v-warn-note">⚠ training-data cutoff</text>`;
    svg += `<text x="${leftCx}" y="${warnY + 22}" class="v-warn-note">⚠ may hallucinate facts</text>`;
    svg += `<text x="${leftCx}" y="${warnY + 44}" class="v-warn-note">⚠ no citations to verify</text>`;
    svg += `<text x="${leftCx}" y="${warnY + 66}" class="v-warn-note">⚠ no access to the corpus</text>`;

    // ----- RIGHT: RAG -----
    svg += step(rightCx, 120, rightW, 40, "Embedding model", null, "v-step");
    svg += arrow(rightCx, 160, 180);
    svg += step(rightCx, 180, rightW, 40, "Vector index search", null, "v-step");
    svg += arrow(rightCx, 220, 240);
    svg += step(rightCx, 240, rightW, 40, "Top-K relevant chunks", null, "v-step");
    svg += arrow(rightCx, 280, 300);
    svg += step(rightCx, 300, rightW, 60, "LLM weights", "+ chunks injected as context", "v-step");
    svg += arrow(rightCx, 360, 395);
    svg += step(rightCx, 395, rightW, 40, "Answer + citations", null, "v-output");

    // Check notes
    const okY = 465;
    svg += `<text x="${rightCx}" y="${okY}"      class="v-ok-note">✓ uses live corpus</text>`;
    svg += `<text x="${rightCx}" y="${okY + 22}" class="v-ok-note">✓ grounded in real text</text>`;
    svg += `<text x="${rightCx}" y="${okY + 44}" class="v-ok-note">✓ citations link to chunks</text>`;

    svg += `</svg>`;

    wrap(root, "An LLM-only pipeline is simpler and lower-latency, but the model can only draw on knowledge encoded in its training weights. A RAG pipeline adds embedding, search, and retrieval steps so the model answers from a specific document corpus and returns citations that map back to retrieved chunks.", svg);
  }

  return { attentionVariants, inferenceLoop, transformerStack, prefillDecode, ragVsLlmOnly };
})();
