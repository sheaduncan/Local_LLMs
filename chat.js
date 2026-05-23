// Local-only chat. Talks to whatever OpenAI-compatible server you have
// running locally (LM Studio, Ollama, llama.cpp server, Jan, vLLM, TGW,
// Tabby, etc.). Auto-detects on common ports. No remote API calls.
//
// Knowledge base modes (chosen via setKbMode):
//   full       — every lesson + glossary (~19K tokens). Best grounding.
//                Needs a model loaded with at least 24K context.
//   retrieve   — BM25 lexical search picks top-K lessons per question.
//                Typically 3-6K tokens. Works on small-context models.
//   current    — only the lesson the user is currently viewing + glossary.
//                Falls back to summaries if not on a lesson page.
//   summaries  — module summaries + lesson titles + glossary (~1.5K tokens).
//   off        — no course material attached. Model answers from training only.

window.CHAT = (function () {
  const LS_ENDPOINT = "ai_training_local_endpoint";
  const LS_MODEL    = "ai_training_local_model";
  const LS_KEY      = "ai_training_local_key";
  const LS_KBMODE   = "ai_training_kb_mode";

  const DEFAULT_ENDPOINT = "http://localhost:1234/v1";
  const DEFAULT_KBMODE   = "retrieve";   // safe for small-context models

  const COMMON_ENDPOINTS = [
    { url: "http://localhost:1234/v1",  name: "LM Studio" },
    { url: "http://localhost:11434/v1", name: "Ollama" },
    { url: "http://localhost:8080/v1",  name: "llama.cpp server" },
    { url: "http://localhost:1337/v1",  name: "Jan" },
    { url: "http://localhost:8000/v1",  name: "vLLM / SGLang" },
    { url: "http://localhost:5000/v1",  name: "TGW / TabbyAPI" },
    { url: "http://localhost:4891/v1",  name: "GPT4All" }
  ];

  const KB_MODES = [
    { id: "full",      label: "Full course — every lesson + glossary",     hint: "~19K tokens. Needs a model loaded with at least 24K context. Best grounding." },
    { id: "retrieve",  label: "Smart retrieval — top 5 lessons per query", hint: "BM25 lexical search picks 3–5 relevant lessons each time. Typical 3–6K tokens. Works on small-context models." },
    { id: "current",   label: "Current lesson + glossary",                 hint: "Only the lesson you're viewing right now plus the glossary. Great for Q&A on what you're reading. Falls back to summaries if not on a lesson page." },
    { id: "summaries", label: "Summaries + lesson titles + glossary",      hint: "Module summaries and lesson titles only — no body content. ~1.5K tokens." },
    { id: "off",       label: "Off — no course context",                   hint: "Model answers from its own training only. Useful for comparing what grounding adds." }
  ];

  // BM25 stopwords — a compact list of common English words that hurt retrieval signal.
  const STOPWORDS = new Set((
    "a an the and or but if then else when where while as is are was were be been being " +
    "have has had do does did doing of in on at to from for by with about against between " +
    "into through during before after above below up down out off over under again further " +
    "more most other some such no nor not only own same so than too very can will just don " +
    "should now this that these those i me my we us our you your he him his she her they them their " +
    "it its what which who whom how why "
  ).split(/\s+/).filter(Boolean));

  let kbFullCache       = null;
  let kbSummariesCache  = null;
  let kbGlossaryCache   = null;
  let kbIndexCache      = null;

  // ---------- Settings storage ----------
  function getEndpoint() { return localStorage.getItem(LS_ENDPOINT) || DEFAULT_ENDPOINT; }
  function setEndpoint(u) {
    if (u && u.trim()) localStorage.setItem(LS_ENDPOINT, u.trim().replace(/\/+$/, ""));
    else localStorage.removeItem(LS_ENDPOINT);
  }
  function getKey()      { return localStorage.getItem(LS_KEY) || ""; }
  function setKey(k)     {
    if (k && k.trim()) localStorage.setItem(LS_KEY, k.trim());
    else localStorage.removeItem(LS_KEY);
  }
  function getModel()    { return localStorage.getItem(LS_MODEL) || ""; }
  function setModel(m)   {
    if (m && m.trim()) localStorage.setItem(LS_MODEL, m.trim());
    else localStorage.removeItem(LS_MODEL);
  }
  function getKbMode()   { return localStorage.getItem(LS_KBMODE) || DEFAULT_KBMODE; }
  function setKbMode(m)  {
    if (m && KB_MODES.find(x => x.id === m)) localStorage.setItem(LS_KBMODE, m);
    else localStorage.removeItem(LS_KBMODE);
  }
  function commonEndpoints() { return COMMON_ENDPOINTS.slice(); }
  function kbModes()         { return KB_MODES.slice(); }

  function authHeaders() {
    const k = getKey();
    return k ? { authorization: "Bearer " + k } : {};
  }

  function nameForPort(url) {
    const found = COMMON_ENDPOINTS.find(e => e.url === url);
    return found ? found.name : null;
  }

  // ---------- Server discovery ----------
  async function probe(url, timeoutMs) {
    timeoutMs = timeoutMs || 1500;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url + "/models", {
        signal: controller.signal,
        headers: { ...authHeaders() }
      });
      if (!res.ok) return { ok: false, url, status: res.status };
      const data = await res.json();
      const models = (data.data || data.models || []).map(m => m.id || m.name || m).filter(Boolean);
      return { ok: true, url, models, name: nameForPort(url) };
    } catch (e) {
      return { ok: false, url, error: e.name === "AbortError" ? "timeout" : (e.message || "unreachable") };
    } finally {
      clearTimeout(t);
    }
  }

  async function detect() {
    const results = await Promise.all(COMMON_ENDPOINTS.map(e => probe(e.url, 1500)));
    return results.find(r => r.ok) || null;
  }

  async function status() {
    return probe(getEndpoint(), 2000);
  }

  // ---------- Block-to-text walker (recurses into expand/defs) ----------
  function blockToText(b, parts) {
    if (b.t === "p" || b.t === "callout") parts.push(b.x);
    else if (b.t === "h")    parts.push("### " + b.x);
    else if (b.t === "code") parts.push("    " + b.x.replace(/\n/g, "\n    "));
    else if (b.t === "list") for (const it of b.items) parts.push("- " + it);
    else if (b.t === "defs") for (const d of b.items) parts.push("- **" + d.term + "**: " + d.def);
    else if (b.t === "expand") {
      parts.push("");
      parts.push("#### " + b.x);
      if (Array.isArray(b.blocks)) for (const inner of b.blocks) blockToText(inner, parts);
    }
    // widget and visual blocks have no text payload for the KB
  }

  function lessonBodyText(lesson) {
    const parts = [];
    for (const b of lesson.blocks) blockToText(b, parts);
    return parts.join("\n");
  }

  // ---------- Glossary block (shared by every mode except "off") ----------
  function buildGlossaryBlock() {
    if (kbGlossaryCache) return kbGlossaryCache;
    const parts = ["# Glossary"];
    for (const g of window.COURSE.glossary) {
      parts.push("- " + g.term + " (" + g.group + "): " + g.def);
    }
    kbGlossaryCache = parts.join("\n");
    return kbGlossaryCache;
  }

  // ---------- KB builders ----------
  function buildFullKb() {
    if (kbFullCache) return kbFullCache;
    const parts = ["COURSE: " + window.COURSE.meta.title, ""];
    for (const mod of window.COURSE.modules) {
      parts.push("# Module " + mod.id + ": " + mod.title);
      parts.push(mod.summary);
      parts.push("");
      for (const lesson of mod.lessons) {
        parts.push("## Lesson " + lesson.id + ": " + lesson.title);
        for (const b of lesson.blocks) blockToText(b, parts);
        parts.push("");
      }
    }
    parts.push(buildGlossaryBlock());
    kbFullCache = parts.join("\n");
    return kbFullCache;
  }

  function buildSummariesKb() {
    if (kbSummariesCache) return kbSummariesCache;
    const parts = ["COURSE: " + window.COURSE.meta.title, "(Summaries only — lesson titles and module summaries.)", ""];
    for (const mod of window.COURSE.modules) {
      parts.push("# Module " + mod.id + ": " + mod.title);
      parts.push(mod.summary);
      parts.push("Lessons:");
      for (const lesson of mod.lessons) parts.push("  - " + lesson.id + ": " + lesson.title);
      parts.push("");
    }
    parts.push(buildGlossaryBlock());
    kbSummariesCache = parts.join("\n");
    return kbSummariesCache;
  }

  function buildKbForLessons(lessonIds) {
    const ids = new Set(lessonIds);
    if (ids.size === 0) return buildSummariesKb();
    const parts = ["COURSE: " + window.COURSE.meta.title,
                   "(Selected lessons only — full content for the relevant lessons plus the glossary.)", ""];
    for (const mod of window.COURSE.modules) {
      const matching = mod.lessons.filter(l => ids.has(l.id));
      if (matching.length === 0) continue;
      parts.push("# Module " + mod.id + ": " + mod.title);
      parts.push(mod.summary);
      parts.push("");
      for (const lesson of matching) {
        parts.push("## Lesson " + lesson.id + ": " + lesson.title);
        for (const b of lesson.blocks) blockToText(b, parts);
        parts.push("");
      }
    }
    parts.push(buildGlossaryBlock());
    return parts.join("\n");
  }

  // ---------- BM25 retrieval (pure JS, no embeddings) ----------
  function tokenizeBM25(s) {
    const tokens = (String(s).toLowerCase().match(/[a-z0-9]+/g) || [])
      .filter(t => t.length > 1 && !STOPWORDS.has(t));
    return tokens;
  }

  function buildIndex() {
    if (kbIndexCache) return kbIndexCache;
    const docs = [];
    const df = new Map();
    for (const mod of window.COURSE.modules) {
      for (const lesson of mod.lessons) {
        const text = lesson.title + "\n" + mod.title + "\n" + mod.summary + "\n" + lessonBodyText(lesson);
        const terms = tokenizeBM25(text);
        const tf = new Map();
        for (const t of terms) tf.set(t, (tf.get(t) || 0) + 1);
        docs.push({ id: lesson.id, modId: mod.id, length: terms.length, tf });
        for (const t of new Set(terms)) df.set(t, (df.get(t) || 0) + 1);
      }
    }
    const avgLen = docs.length === 0 ? 1 : docs.reduce((s, d) => s + d.length, 0) / docs.length;
    kbIndexCache = { docs, df, avgLen, N: docs.length };
    return kbIndexCache;
  }

  function searchLessons(query, k) {
    const idx = buildIndex();
    const qTerms = tokenizeBM25(query);
    if (qTerms.length === 0) return [];
    const k1 = 1.5, b = 0.75;
    const scored = idx.docs.map(d => {
      let score = 0;
      for (const t of qTerms) {
        const tf = d.tf.get(t);
        if (!tf) continue;
        const dfVal = idx.df.get(t) || 0;
        const idf = Math.log(1 + (idx.N - dfVal + 0.5) / (dfVal + 0.5));
        const norm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * d.length / idx.avgLen));
        score += idf * norm;
      }
      return { id: d.id, modId: d.modId, score };
    }).filter(x => x.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k || 5);
  }

  // ---------- Current lesson from the URL hash ----------
  function currentLessonId() {
    const m = (typeof location !== "undefined" && location.hash ? location.hash : "")
      .match(/#\/course\/(m\d+l\d+)/);
    return m ? m[1] : null;
  }

  // ---------- Pick the KB for the chosen mode ----------
  function buildKbForMode(mode, query) {
    if (mode === "full")      return buildFullKb();
    if (mode === "summaries") return buildSummariesKb();
    if (mode === "off")       return "";
    if (mode === "current") {
      const id = currentLessonId();
      if (id) return buildKbForLessons([id]);
      return buildSummariesKb();
    }
    if (mode === "retrieve") {
      if (!query || !query.trim()) return buildSummariesKb();
      const top = searchLessons(query, 5);
      if (top.length === 0) return buildSummariesKb();
      return buildKbForLessons(top.map(t => t.id));
    }
    return buildFullKb();
  }

  function estimateTokens(text) {
    return Math.round((text || "").length / 4);
  }
  function estimateTokensForMode(mode, query) {
    return estimateTokens(buildKbForMode(mode, query || ""));
  }

  // Legacy entry point still used by app.js for the guidance-panel size hint
  function buildKnowledgeBase() { return buildFullKb(); }

  // ---------- Send ----------
  function systemPromptForMode(mode, query) {
    const kb = buildKbForMode(mode, query);
    if (!kb) {
      return (
        "You are a teaching assistant for a self-paced course on running large language models locally. " +
        "No course material is attached for this request — answer briefly from your own training, and tell the user when something is outside what you can verify. " +
        "Keep responses tight."
      );
    }
    return (
      "You are a teaching assistant for a self-paced course on running large language models locally. " +
      "Answer using the course material below as your primary source. " +
      "When you make a claim that comes from the course, cite the lesson by its ID in the form m3l4 (or m1l5, m6l2, etc.) — just the ID, the UI turns it into a clickable link. " +
      "If a question is outside the course material, answer briefly and say so plainly. " +
      "Prefer concrete, specific answers grounded in the lessons over generic advice. Keep responses tight.\n\n" +
      "===== COURSE MATERIAL =====\n\n" +
      kb
    );
  }

  async function send(messages) {
    const endpoint = getEndpoint();
    const model = getModel();
    if (!model) throw new Error("No model selected. Pick one from the dropdown after connecting.");

    const mode = getKbMode();
    const lastUser = (messages || []).filter(m => m.role === "user").slice(-1)[0];
    const query = lastUser ? lastUser.content : "";
    const sys = systemPromptForMode(mode, query);

    const body = {
      model,
      messages: [{ role: "system", content: sys }, ...messages],
      max_tokens: 1024,
      temperature: 0.3,
      stream: false
    };

    let res;
    try {
      res = await fetch(endpoint + "/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify(body)
      });
    } catch (e) {
      throw new Error(
        "Could not reach local server at " + endpoint + ". " +
        "Make sure it's running and CORS is enabled. " +
        "(Common: LM Studio needs 'Enable CORS' in the server settings; Ollama needs OLLAMA_ORIGINS=* in env.)"
      );
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      let msg;
      try {
        const parsed = JSON.parse(errText);
        msg = (parsed.error && (parsed.error.message || parsed.error)) || errText;
      } catch { msg = errText; }
      throw new Error("Local server returned " + res.status + ": " + (msg || "(empty)"));
    }

    const data = await res.json();
    const choice = (data.choices && data.choices[0]) || null;
    const text = choice ? (choice.message && choice.message.content) || "" : "";
    return { text: text.trim(), usage: data.usage || null, kbMode: mode };
  }

  return {
    getEndpoint, setEndpoint,
    getKey, setKey,
    getModel, setModel,
    getKbMode, setKbMode,
    commonEndpoints, kbModes,
    probe, detect, status,
    send,
    searchLessons,
    estimateTokensForMode,
    currentLessonId,
    buildKnowledgeBase
  };
})();
