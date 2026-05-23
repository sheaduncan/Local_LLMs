// SPA controller: routing + four views (course, wizard, glossary, chat).

(function () {
  // ---------- State ----------
  const STORAGE_PROGRESS = "ai_training_progress_v1";
  const STORAGE_LAST_LESSON = "ai_training_last_lesson";

  const state = {
    progress: loadProgress(),   // { completed: {lessonId: true}, scores: {lessonId: {correct,total}} }
    wizard:   { step: 0, answers: {} },
    chat:     { messages: [] }  // session-only
  };

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_PROGRESS);
      if (!raw) return { completed: {}, scores: {} };
      return JSON.parse(raw);
    } catch { return { completed: {}, scores: {} }; }
  }
  function saveProgress() {
    localStorage.setItem(STORAGE_PROGRESS, JSON.stringify(state.progress));
  }

  // ---------- Helpers ----------
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function flatLessons() {
    const out = [];
    for (const mod of window.COURSE.modules) {
      for (const lesson of mod.lessons) out.push({ mod, lesson });
    }
    return out;
  }
  function findLesson(lessonId) {
    return flatLessons().find(x => x.lesson.id === lessonId) || flatLessons()[0];
  }

  // ---------- Routing ----------
  function parseRoute() {
    const hash = location.hash.replace(/^#\/?/, "") || "course";
    const parts = hash.split("/");
    return { name: parts[0], param: parts[1] };
  }
  function navigate(path) { location.hash = "#/" + path; }
  window.addEventListener("hashchange", render);
  window.addEventListener("DOMContentLoaded", init);

  function init() {
    if (!location.hash) location.hash = "#/course";
    render();
  }

  function highlightNav(name) {
    $$(".navlinks a").forEach(a => {
      a.classList.toggle("active", a.dataset.route === name);
    });
  }

  function render() {
    const route = parseRoute();
    highlightNav(route.name);
    const app = $("#app");
    app.innerHTML = "";
    if (route.name === "course")     return renderCourse(app, route.param);
    if (route.name === "wizard")     return renderWizard(app);
    if (route.name === "glossary")   return renderGlossary(app);
    if (route.name === "references") return renderReferences(app);
    if (route.name === "chat")       return renderChat(app);
    app.innerHTML = "<p>Not found.</p>";
  }

  // ---------- Course view ----------
  function renderCourse(root, lessonId) {
    if (!lessonId) {
      lessonId = localStorage.getItem(STORAGE_LAST_LESSON) || window.COURSE.modules[0].lessons[0].id;
    }
    const { mod, lesson } = findLesson(lessonId);
    localStorage.setItem(STORAGE_LAST_LESSON, lesson.id);

    const layout = document.createElement("div");
    layout.className = "course-layout";
    layout.appendChild(renderSidebar(lesson.id));
    layout.appendChild(renderLesson(mod, lesson));
    root.appendChild(layout);

    // Scroll to top of lesson when navigating
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function renderSidebar(activeId) {
    const aside = document.createElement("aside");
    aside.className = "sidebar";
    const parts = [`<h4>Course outline</h4>`];
    for (const mod of window.COURSE.modules) {
      parts.push(`<div class="mod-title">${esc(mod.title)}</div>`);
      for (const lesson of mod.lessons) {
        const isDone = !!state.progress.completed[lesson.id];
        const active = lesson.id === activeId ? " active" : "";
        parts.push(
          `<div class="lesson-link${active}" data-lesson="${esc(lesson.id)}">` +
            `<span>${esc(lesson.title)}</span>` +
            (isDone ? `<span class="check">✓</span>` : "") +
          `</div>`
        );
      }
    }
    aside.innerHTML = parts.join("");
    aside.addEventListener("click", e => {
      const link = e.target.closest(".lesson-link");
      if (link) navigate("course/" + link.dataset.lesson);
    });
    return aside;
  }

  function renderLesson(mod, lesson) {
    const all = flatLessons();
    const idx = all.findIndex(x => x.lesson.id === lesson.id);
    const prev = idx > 0 ? all[idx - 1].lesson : null;
    const next = idx < all.length - 1 ? all[idx + 1].lesson : null;

    const wrap = document.createElement("section");
    wrap.className = "lesson";

    const blocksHtml = lesson.blocks.map(renderBlock).join("");

    const score = state.progress.scores[lesson.id];
    const scoreLine = score ? `<span style="margin-left:10px;font-size:13px;color:var(--text-mute);">Quiz: ${score.correct}/${score.total}</span>` : "";

    wrap.innerHTML = `
      <div class="crumb">${esc(mod.title)}</div>
      <h1>${esc(lesson.title)}${scoreLine}</h1>
      ${blocksHtml}
      <div class="quiz">
        <h3 class="quiz-title">Check your understanding</h3>
        <div class="quiz-body"></div>
      </div>
      <div class="lesson-nav">
        <button class="prev" ${prev ? "" : "disabled"}>${prev ? "← " + esc(prev.title) : "← Previous"}</button>
        <button class="mark">${state.progress.completed[lesson.id] ? "✓ Completed" : "Mark complete"}</button>
        <button class="next" ${next ? "" : "disabled"}>${next ? esc(next.title) + " →" : "Next →"}</button>
      </div>
    `;

    renderQuiz($(".quiz-body", wrap), lesson);
    mountWidgets(wrap);

    $(".prev", wrap).addEventListener("click", () => { if (prev) navigate("course/" + prev.id); });
    $(".next", wrap).addEventListener("click", () => { if (next) navigate("course/" + next.id); });
    $(".mark", wrap).addEventListener("click", () => {
      state.progress.completed[lesson.id] = !state.progress.completed[lesson.id];
      saveProgress();
      render();
    });
    return wrap;
  }

  function renderBlock(b) {
    if (b.t === "p")       return `<p>${esc(b.x)}</p>`;
    if (b.t === "h")       return `<h3>${esc(b.x)}</h3>`;
    if (b.t === "callout") return `<div class="callout">${esc(b.x)}</div>`;
    if (b.t === "code")    return `<pre><code>${esc(b.x)}</code></pre>`;
    if (b.t === "list")    return `<ul>${b.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>`;
    if (b.t === "widget")  return `<div class="widget" data-widget="${esc(b.id)}"></div>`;
    if (b.t === "visual")  return `<div class="visual" data-visual="${esc(b.id)}"></div>`;
    if (b.t === "defs")    return `<dl class="defs">${b.items.map(d => `<dt>${esc(d.term)}</dt><dd>${esc(d.def)}</dd>`).join("")}</dl>`;
    if (b.t === "expand")  return `<details class="expand"><summary>${esc(b.x)}</summary><div class="expand-body">${(b.blocks || []).map(renderBlock).join("")}</div></details>`;
    return "";
  }

  function mountWidgets(root) {
    if (window.WIDGETS) {
      $$(".widget[data-widget]", root).forEach(el => {
        const id = el.dataset.widget;
        const fn = window.WIDGETS[id];
        if (fn) fn(el);
        else el.innerHTML = `<div style="color:var(--text-mute);font-style:italic;">Widget "${esc(id)}" not found.</div>`;
      });
    }
    if (window.VISUALS) {
      $$(".visual[data-visual]", root).forEach(el => {
        const id = el.dataset.visual;
        const fn = window.VISUALS[id];
        if (fn) fn(el);
        else el.innerHTML = `<div style="color:var(--text-mute);font-style:italic;">Visual "${esc(id)}" not found.</div>`;
      });
    }
  }

  function renderQuiz(root, lesson) {
    if (!lesson.quiz || lesson.quiz.length === 0) {
      root.innerHTML = `<div class="quiz-empty">No quiz for this lesson yet — coming soon.</div>`;
      return;
    }
    // Local per-render state for the quiz
    const qState = lesson.quiz.map(() => ({ selected: null, checked: false }));

    function paint() {
      root.innerHTML = "";
      lesson.quiz.forEach((q, qi) => {
        const card = document.createElement("div");
        card.className = "q-card";
        const opts = q.a.map((opt, oi) => {
          const checked = qState[qi].selected === oi;
          const cls = ["opt"];
          if (qState[qi].checked) {
            cls.push("locked");
            if (oi === q.c) cls.push("correct");
            else if (checked) cls.push("wrong");
          }
          return `<label class="${cls.join(" ")}">
            <input type="radio" name="q${qi}" ${checked ? "checked" : ""} ${qState[qi].checked ? "disabled" : ""} data-opt="${oi}">
            ${esc(opt)}
          </label>`;
        }).join("");
        card.innerHTML = `
          <div class="q-text">${qi + 1}. ${esc(q.q)}</div>
          ${opts}
          <div style="margin-top:10px;">
            <button class="check-btn" ${qState[qi].selected === null || qState[qi].checked ? "disabled" : ""}>
              ${qState[qi].checked ? (qState[qi].selected === q.c ? "Correct" : "See explanation") : "Check"}
            </button>
          </div>
          ${qState[qi].checked ? `<div class="explain"><strong>Why:</strong> ${esc(q.e)}</div>` : ""}
        `;
        card.addEventListener("change", e => {
          if (e.target.matches('input[type="radio"]') && !qState[qi].checked) {
            qState[qi].selected = parseInt(e.target.dataset.opt, 10);
            paint();
          }
        });
        $(".check-btn", card).addEventListener("click", () => {
          if (qState[qi].selected === null) return;
          qState[qi].checked = true;
          // Save score progress when all are checked
          if (qState.every(s => s.checked)) {
            const correct = qState.reduce((n, s, i) => n + (s.selected === lesson.quiz[i].c ? 1 : 0), 0);
            state.progress.scores[lesson.id] = { correct, total: lesson.quiz.length };
            saveProgress();
          }
          paint();
        });
        root.appendChild(card);
      });
    }
    paint();
  }

  // ---------- Wizard view ----------
  function renderWizard(root) {
    const wrap = document.createElement("div");
    wrap.className = "wizard-wrap";
    wrap.innerHTML = `
      <h1>Find your local-LLM setup</h1>
      <p class="lede">Answer five questions. Get a setup tailored to your hardware and use case, with every recommendation linked to the lesson that explains why.</p>
      <div class="wizard-card" id="wcard"></div>
    `;
    root.appendChild(wrap);
    paintWizard();
  }

  function paintWizard() {
    const card = $("#wcard");
    const qs = window.WIZARD.questions;
    const total = qs.length;
    const step = state.wizard.step;

    if (step >= total) return paintWizardResults();

    const q = qs[step];
    const answers = state.wizard.answers;
    const current = answers[q.id];

    const progressHtml = qs.map((_, i) => {
      const cls = i < step ? "done" : (i === step ? "current" : "");
      return `<div class="step ${cls}"></div>`;
    }).join("");

    const optsHtml = q.options.map(opt => `
      <label class="wizard-opt ${current === opt.id ? "selected" : ""}">
        <input type="radio" name="wq" value="${esc(opt.id)}" style="display:none">
        ${esc(opt.label)}
      </label>
    `).join("");

    card.innerHTML = `
      <div class="wizard-progress">${progressHtml}</div>
      <div class="wizard-q-title">${esc(q.title)}</div>
      ${q.help ? `<div class="wizard-q-help">${esc(q.help)}</div>` : ""}
      <div class="wizard-opts">${optsHtml}</div>
      <div class="wizard-nav">
        <button class="back" ${step === 0 ? "disabled" : ""}>← Back</button>
        <button class="primary next" ${current ? "" : "disabled"}>${step === total - 1 ? "Get recommendation →" : "Next →"}</button>
      </div>
    `;

    $$(".wizard-opt", card).forEach(el => {
      el.addEventListener("click", () => {
        const val = $('input[type="radio"]', el).value;
        state.wizard.answers[q.id] = val;
        paintWizard();
      });
    });
    $(".back", card).addEventListener("click", () => {
      if (state.wizard.step > 0) { state.wizard.step -= 1; paintWizard(); }
    });
    $(".next", card).addEventListener("click", () => {
      if (!current) return;
      state.wizard.step += 1;
      paintWizard();
    });
  }

  function paintWizardResults() {
    const card = $("#wcard");
    const result = window.WIZARD.recommend(state.wizard.answers);

    const fieldHtml = result.fields.map(f => `
      <div class="rec-field">
        <div class="label">${esc(f.label)}</div>
        <div>
          <div class="value">${esc(f.value)}</div>
          <div class="why">${esc(f.why)}</div>
          <a class="why-link" href="#/course/${esc(f.whyRef)}">Read the lesson that explains why →</a>
        </div>
      </div>
    `).join("");

    const warnHtml = result.warnings.length === 0 ? "" : `
      <div class="results-section">
        <h3>Heads up</h3>
        ${result.warnings.map(w => `
          <div class="warn-item">
            ${esc(w.value)}
            <a class="why-link" href="#/course/${esc(w.whyRef)}">Read the lesson →</a>
          </div>
        `).join("")}
      </div>
    `;

    const tipHtml = `
      <div class="results-section">
        <h3>Always do these</h3>
        ${result.tips.map(t => `
          <div class="tip-item">
            ${esc(t.value)}
            <a class="why-link" href="#/course/${esc(t.whyRef)}">Read the lesson →</a>
          </div>
        `).join("")}
      </div>
    `;

    card.innerHTML = `
      <div class="results">
        <h2>Your recommendation</h2>
        <div class="summary">${esc(result.summary)}</div>
        <div class="results-section">
          <h3>Setup</h3>
          ${fieldHtml}
        </div>
        ${warnHtml}
        ${tipHtml}
        <div class="wizard-nav" style="margin-top:24px;">
          <button class="restart">← Start over</button>
          <a class="primary" href="#/course" style="text-decoration:none;padding:9px 18px;background:var(--accent);color:white;border-radius:var(--radius-sm);font-size:14px;">Browse the course →</a>
        </div>
      </div>
    `;
    $(".restart", card).addEventListener("click", () => {
      state.wizard = { step: 0, answers: {} };
      paintWizard();
    });
  }

  // ---------- Glossary view ----------
  function renderGlossary(root) {
    const wrap = document.createElement("div");
    wrap.className = "glossary-wrap";
    wrap.innerHTML = `
      <h1 style="margin:0 0 6px;font-size:26px;letter-spacing:-0.015em;">Glossary</h1>
      <p style="color:var(--text-dim);margin-bottom:18px;">Quick definitions for terms used throughout the course.</p>
      <input class="glossary-search" type="text" placeholder="Filter terms (e.g. attention, RAG, GGUF)…">
      <div class="glossary-list"></div>
    `;
    root.appendChild(wrap);
    paintGlossary("");
    $(".glossary-search", wrap).addEventListener("input", e => paintGlossary(e.target.value));
  }
  function paintGlossary(query) {
    const list = $(".glossary-list");
    const q = (query || "").trim().toLowerCase();
    const groups = {};
    for (const item of window.COURSE.glossary) {
      if (q && !(item.term.toLowerCase().includes(q) || item.def.toLowerCase().includes(q))) continue;
      (groups[item.group] = groups[item.group] || []).push(item);
    }
    if (Object.keys(groups).length === 0) {
      list.innerHTML = `<p style="color:var(--text-mute);">No matches.</p>`;
      return;
    }
    list.innerHTML = Object.entries(groups).map(([group, items]) => `
      <div class="glossary-group">
        <h3>${esc(group)}</h3>
        ${items.map(i => `
          <div class="glossary-item">
            <div class="term">${esc(i.term)}</div>
            <div class="def">${esc(i.def)}</div>
          </div>
        `).join("")}
      </div>
    `).join("");
  }

  // ---------- References view ----------
  const REFERENCES = {
    videoGroups: [
      {
        author: "3Blue1Brown",
        authorUrl: "https://www.youtube.com/@3blue1brown",
        note: "Grant Sanderson's visual mathematics channel. Animation-driven explanations of attention, the Transformer architecture, and how LLMs encode information — strong companion material to the conceptual lessons in Module 1.",
        videos: [
          { title: "Large Language Models explained briefly", url: "https://youtu.be/LPZh9BOjkQs?si=gld2lV7k6_NVn87M", relates: [{ id: "m1l1", label: "What an LLM Actually Does" }] },
          { title: "Transformers, the tech behind LLMs",      url: "https://youtu.be/wjZofJX0v4M?si=y6YDU_3l1c6P1sOp", relates: [{ id: "m1l3", label: "Transformers" }] },
          { title: "Attention in transformers, step-by-step", url: "https://youtu.be/eMlx5fFNoYc?si=SlXMq5XdB0gzEZvC", relates: [{ id: "m1l4", label: "Attention" }] },
          { title: "How might LLMs store facts",              url: "https://youtu.be/9-Jl0dxWQs8?si=_C9Bjdm7SHwfH1jG", relates: [{ id: "m1l3", label: "Transformers (MLP / parameters)" }] }
        ]
      },
      {
        author: "Andrej Karpathy",
        authorUrl: "https://www.youtube.com/@AndrejKarpathy",
        note: "Hands-on, build-it-from-scratch lectures on tokenization, the Transformer architecture, and end-to-end LLM workflows. The Neural Networks: Zero to Hero series is the canonical code-along resource for understanding what happens inside a model.",
        videos: [
          { title: "[1hr Talk] Intro to Large Language Models", url: "https://youtu.be/zjkBMFhNj_g", relates: [{ id: "m1l1", label: "What an LLM Actually Does" }] },
          { title: "Let's build the GPT Tokenizer", url: "https://youtu.be/zduSFxRajkE", relates: [{ id: "m1l2", label: "Tokens" }] },
          { title: "Let's build GPT: from scratch, in code, spelled out", url: "https://youtu.be/kCc8FmEb1nY", relates: [{ id: "m1l3", label: "Transformers" }, { id: "m1l4", label: "Attention" }] },
          { title: "Deep Dive into LLMs like ChatGPT", url: "https://youtu.be/7xTGNNLPyMI?si=YsvlVoHAGUE3AKkp", relates: [{ id: "course", label: "the entire course" }] },
          { title: "How I use LLMs", url: "https://youtu.be/EWvNQjAaOHw", relates: [{ id: "m5l5", label: "Coding With Local Models" }] },
          { title: "Let's reproduce GPT-2 (124M)", url: "https://youtu.be/l8pRSuU81PU", relates: [{ id: "m5l7", label: "Fine-Tuning" }] }
        ]
      },
      {
        author: "Jay Alammar",
        authorUrl: "https://www.youtube.com/@arp_ai",
        note: "Author of The Illustrated Transformer — the canonical visual reference for the architecture. His narrated video walks through the same diagrams as the blog post for those who prefer video.",
        videos: [
          { title: "The Narrated Transformer Language Model", url: "https://youtu.be/-QH8fRhqFHM", relates: [{ id: "m1l3", label: "Transformers" }, { id: "m1l4", label: "Attention" }] }
        ]
      },
      {
        author: "MIT 6.S191 — Alexander Amini",
        authorUrl: "https://www.youtube.com/@AAmini",
        note: "MIT's introductory deep learning course, refreshed annually with current research. Lecture-format treatment of attention, Transformers, and LLM techniques — strong complement to the shorter intuition videos.",
        videos: [
          { title: "MIT 6.S191: Introduction to Deep Learning (course site)", url: "http://introtodeeplearning.com/", relates: [{ id: "course", label: "the entire course" }] },
          { title: "MIT 6.S191: Recurrent Neural Networks, Transformers, and Attention", url: "https://youtu.be/dqoEU9Ac3ek", relates: [{ id: "m1l3", label: "Transformers" }, { id: "m1l4", label: "Attention" }] },
          { title: "MIT 6.S191: Large Language Models", url: "https://youtu.be/ZNodOsz94cc", relates: [{ id: "m1l1", label: "What an LLM Actually Does" }] }
        ]
      }
    ],
    articleGroups: [
      {
        author: "Jay Alammar",
        authorUrl: "https://jalammar.github.io/",
        note: "The visual-explanation reference standard for Transformer-family architectures. The Illustrated Transformer remains one of the most widely cited introductions to the architecture.",
        articles: [
          { title: "The Illustrated Transformer", url: "https://jalammar.github.io/illustrated-transformer/", relates: [{ id: "m1l3", label: "Transformers" }, { id: "m1l4", label: "Attention" }] },
          { title: "The Illustrated GPT-2 (Visualizing Transformer Language Models)", url: "https://jalammar.github.io/illustrated-gpt2/", relates: [{ id: "m1l3", label: "Transformers" }, { id: "m1l6", label: "Prefill and Decode" }] }
        ]
      },
      {
        author: "Lilian Weng",
        authorUrl: "https://lilianweng.github.io/",
        note: "Long-form, survey-style technical posts. Among the strongest entry points for understanding the LLM agent landscape, prompt engineering as a discipline, and the broader research context.",
        articles: [
          { title: "LLM Powered Autonomous Agents", url: "https://lilianweng.github.io/posts/2023-06-23-agent/", relates: [{ id: "m5l6", label: "Local Agents Need Guardrails" }] },
          { title: "Prompt Engineering", url: "https://lilianweng.github.io/posts/2023-03-15-prompt-engineering/", relates: [{ id: "m5l1", label: "Long Context" }, { id: "m5l5", label: "Coding With Local Models" }] }
        ]
      },
      {
        author: "Eugene Yan",
        authorUrl: "https://eugeneyan.com/",
        note: "Practical, production-oriented writeups on RAG, evaluation, and applied LLM patterns. Grounds theoretical content in real deployment experience.",
        articles: [
          { title: "Patterns for Building LLM-based Systems & Products", url: "https://eugeneyan.com/writing/llm-patterns/", relates: [{ id: "m5l3", label: "RAG Beats Giant Prompts" }, { id: "m6l5", label: "Benchmarks That Matter" }] },
          { title: "What We've Learned From A Year of Building with LLMs", url: "https://applied-llms.org/", relates: [{ id: "course", label: "the entire course" }] }
        ]
      },
      {
        author: "Sebastian Raschka",
        authorUrl: "https://sebastianraschka.com/",
        note: "Technical depth on model architecture, fine-tuning, quantization, and the mathematics behind modern LLMs. Author of Build a Large Language Model from Scratch and the Ahead of AI newsletter.",
        articles: [
          { title: "Build a Large Language Model From Scratch (book + code)", url: "https://www.manning.com/books/build-a-large-language-model-from-scratch", relates: [{ id: "m1l3", label: "Transformers" }, { id: "m5l7", label: "Fine-Tuning" }] },
          { title: "Ahead of AI (technical newsletter)", url: "https://magazine.sebastianraschka.com/", relates: [{ id: "course", label: "the entire course" }] },
          { title: "Practical Tips for Finetuning LLMs Using LoRA", url: "https://magazine.sebastianraschka.com/p/practical-tips-for-finetuning-llms", relates: [{ id: "m5l7", label: "Fine-Tuning" }] }
        ]
      },
      {
        author: "Hugging Face",
        authorUrl: "https://huggingface.co/learn",
        note: "Maintainer of Transformers, datasets, and the de facto open-weight model hub. The free LLM Course is hands-on with code and currently the most comprehensive free curriculum available.",
        articles: [
          { title: "Hugging Face LLM Course", url: "https://huggingface.co/learn/llm-course", relates: [{ id: "course", label: "the entire course" }] },
          { title: "Hugging Face NLP Course", url: "https://huggingface.co/learn/nlp-course", relates: [{ id: "m1l3", label: "Transformers" }, { id: "m5l7", label: "Fine-Tuning" }] }
        ]
      },
      {
        author: "Anthropic",
        authorUrl: "https://www.anthropic.com/research",
        note: "Engineering guides and research from a frontier model lab. Strong material on agents, prompt engineering, and applied safety patterns.",
        articles: [
          { title: "Building Effective Agents", url: "https://www.anthropic.com/research/building-effective-agents", relates: [{ id: "m5l6", label: "Local Agents Need Guardrails" }] },
          { title: "Prompt Engineering Overview", url: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview", relates: [{ id: "m5l1", label: "Long Context" }, { id: "m5l5", label: "Coding With Local Models" }] }
        ]
      },
      {
        author: "Simon Willison",
        authorUrl: "https://simonwillison.net/",
        note: "Day-by-day practical writeups on local LLMs, prompt injection, model releases, and the operational realities of working with current models. The LLMs tag index is the relevant entry point.",
        articles: [
          { title: "LLMs — tag index (latest posts)", url: "https://simonwillison.net/tags/llms/", relates: [{ id: "course", label: "the entire course" }] },
          { title: "Prompt injection — tag index", url: "https://simonwillison.net/tags/prompt-injection/", relates: [{ id: "m5l6", label: "Local Agents Need Guardrails" }] }
        ]
      }
    ]
  };

  function relatesChips(relates) {
    if (!relates || relates.length === 0) return "";
    return `<div class="ref-relates">
      ${relates.map(r => r.id === "course"
        ? `<span class="ref-chip ref-chip-static">${esc(r.label)}</span>`
        : `<a class="ref-chip" href="#/course/${esc(r.id)}">${esc(r.label)}</a>`
      ).join("")}
    </div>`;
  }

  function renderReferences(root) {
    const wrap = document.createElement("div");
    wrap.className = "ref-wrap";

    const videoGroupsHtml = REFERENCES.videoGroups.map(g => `
      <div class="ref-group">
        <div class="ref-group-head">
          <a class="ref-group-name" href="${esc(g.authorUrl)}" target="_blank" rel="noopener">${esc(g.author)} <span class="ref-ext">↗</span></a>
        </div>
        <div class="ref-group-note">${esc(g.note)}</div>
        <div class="ref-video-list">
          ${g.videos.map(v => `
            <div class="ref-card ref-video">
              <a class="ref-title" href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.title)} <span class="ref-ext">↗</span></a>
              ${relatesChips(v.relates)}
            </div>
          `).join("")}
        </div>
      </div>
    `).join("");

    const articleGroupsHtml = REFERENCES.articleGroups.map(g => `
      <div class="ref-group">
        <div class="ref-group-head">
          <a class="ref-group-name" href="${esc(g.authorUrl)}" target="_blank" rel="noopener">${esc(g.author)} <span class="ref-ext">↗</span></a>
        </div>
        <div class="ref-group-note">${esc(g.note)}</div>
        <div class="ref-video-list">
          ${g.articles.map(a => `
            <div class="ref-card ref-video">
              <a class="ref-title" href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.title)} <span class="ref-ext">↗</span></a>
              ${relatesChips(a.relates)}
            </div>
          `).join("")}
        </div>
      </div>
    `).join("");

    wrap.innerHTML = `
      <h1 style="margin:0 0 6px;font-size:26px;letter-spacing:-0.015em;">References</h1>
      <p style="color:var(--text-dim);margin-bottom:24px;">Outside resources that complement the course — videos, articles, and courses with lesson tie-ins. Lesson chips link straight to the relevant section.</p>

      <div class="ref-section">
        <h2 class="ref-section-title">Videos</h2>
        ${videoGroupsHtml}
      </div>

      <div class="ref-section">
        <h2 class="ref-section-title">Articles and courses</h2>
        ${articleGroupsHtml}
      </div>
    `;
    root.appendChild(wrap);
  }

  // ---------- Chat view ----------
  function renderChat(root) {
    const wrap = document.createElement("div");
    wrap.className = "chat-wrap";

    wrap.innerHTML = `
      <h1 style="margin:0 0 6px;font-size:26px;letter-spacing:-0.015em;">Course chat — local model</h1>
      <p style="color:var(--text-dim);margin-bottom:18px;">
        This chat talks to <strong>your own local LLM server</strong> over its OpenAI-compatible API.
        No remote calls. No keys to manage (most of the time). Click <strong>Detect local server</strong> to find one running on your machine.
      </p>

      <details class="provider-info-panel" id="how-guided" open>
        <summary><strong>How this chat is guided</strong> — what actually goes to your local model</summary>
        <ol class="guidance-list">
          <li><strong>System prompt:</strong> your local model is told it's a teaching assistant for this course, must answer using the course material, and must cite the relevant lesson when making claims (the model emits short IDs internally; you see the lesson title).</li>
          <li><strong>Knowledge base:</strong> course content is attached to every request — how much depends on your <strong>KB mode</strong> (set in <em>Local server</em> settings). Current mode: <strong id="kb-mode-label">…</strong> — about <strong id="kb-tokens">…</strong> tokens. Your local server's <strong>prefix cache</strong> handles repeat calls cheaply (see <a class="cite" href="#/course/m4l3">Production Serving Modes</a>).</li>
          <li><strong>Your question</strong> is appended after the knowledge base.</li>
          <li><strong>Your local model</strong> answers grounded in the course; every lesson reference in the reply becomes a clickable link to that section.</li>
          <li><strong>Off-course questions:</strong> the model will answer briefly but flag them as outside the course material.</li>
        </ol>
        <div class="guidance-suggest">
          <span class="suggest-label">Try one of these:</span>
          <div class="suggest-chips" id="suggest-chips"></div>
        </div>
      </details>

      <details class="provider-info-panel" open>
        <summary><strong>How to start a local model server</strong> — four quickstarts</summary>
        <a class="wizard-link" href="#/wizard">
          <span class="wl-icon">→</span>
          <span class="wl-text"><strong>Not sure which model can I run?</strong> Run the wizard — it asks 5 questions about your hardware and returns a model size, quantization, and runtime tailored to you.</span>
        </a>
        <div class="provider-info-list">
          <div class="provider-info">
            <div class="provider-info-head">
              <span class="pi-name">LM Studio</span>
              <a class="pi-link" href="https://lmstudio.ai" target="_blank" rel="noopener">lmstudio.ai →</a>
            </div>
            <div class="pi-desc">Easiest path. Install, search for a model (e.g. Qwen 2.5 7B Instruct GGUF), download, open the Developer tab, click <em>Start Server</em>. Default port <code>1234</code>. Enable <em>"Allow CORS"</em> in server settings so this page can call it.</div>
            <div class="pi-meta">
              <span class="pi-cors ok">Default: http://localhost:1234/v1</span>
            </div>
          </div>
          <div class="provider-info">
            <div class="provider-info-head">
              <span class="pi-name">Ollama</span>
              <a class="pi-link" href="https://ollama.com" target="_blank" rel="noopener">ollama.com →</a>
            </div>
            <div class="pi-desc">A convenience wrapper around llama.cpp with one-line model pulls and a simple CLI. Detection works at <code>http://localhost:11434/v1</code>. Trades direct runtime control for ease of setup; for finer-grained flag control, prefer llama.cpp directly. See <a href="#/course/m4l1">Runtimes and Choosing an Engine</a> for the broader engine landscape.</div>
            <div class="pi-meta">
              <span class="pi-cors ok">Default: http://localhost:11434/v1</span>
            </div>
          </div>
          <div class="provider-info">
            <div class="provider-info-head">
              <span class="pi-name">llama.cpp server</span>
              <a class="pi-link" href="https://github.com/ggml-org/llama.cpp" target="_blank" rel="noopener">github →</a>
            </div>
            <div class="pi-desc">For the portable workhorse path. Build llama.cpp, then run <code>llama-server -m /path/to/model.gguf --port 8080</code>. CORS is on by default. Lower-level; you choose the model file and runtime flags.</div>
            <div class="pi-meta">
              <span class="pi-cors ok">Default: http://localhost:8080/v1</span>
            </div>
          </div>
          <div class="provider-info">
            <div class="provider-info-head">
              <span class="pi-name">vLLM <span style="font-size:11px;color:var(--text-mute);font-weight:400;">— Linux + NVIDIA</span></span>
              <a class="pi-link" href="https://docs.vllm.ai" target="_blank" rel="noopener">docs.vllm.ai →</a>
            </div>
            <div class="pi-desc">Production-grade serving — continuous batching, paged attention, OpenAI-compatible. Install with <code>pip install vllm</code>, then <code>vllm serve Qwen/Qwen2.5-7B-Instruct --allowed-origins '*'</code>. Default port <code>8000</code>. The <code>--allowed-origins</code> flag is what makes browser calls work (or proxy through nginx).</div>
            <div class="pi-meta">
              <span class="pi-cors ok">Default: http://localhost:8000/v1</span>
            </div>
          </div>
        </div>
      </details>

      <div class="chat-settings">
        <h3>Local server</h3>
        <div class="row">
          <label for="endpoint">Endpoint</label>
          <input id="endpoint" type="text" placeholder="http://localhost:1234/v1" value="${esc(window.CHAT.getEndpoint())}">
          <span id="conn-status" class="conn-badge">checking…</span>
        </div>
        <div class="row">
          <label for="modelsel">Model</label>
          <select id="modelsel"><option value="">(not connected)</option></select>
          <span></span>
        </div>
        <div class="row">
          <label for="apikey">API key (optional)</label>
          <input id="apikey" type="password" placeholder="most local servers don't need this" value="${esc(window.CHAT.getKey())}">
          <span class="saved" id="savedmark"></span>
        </div>
        <div class="row">
          <label for="kbmode">Knowledge base</label>
          <select id="kbmode">
            ${window.CHAT.kbModes().map(m =>
              `<option value="${esc(m.id)}" ${window.CHAT.getKbMode() === m.id ? "selected" : ""}>${esc(m.label)}</option>`
            ).join("")}
          </select>
          <span class="kb-est" id="kb-est"></span>
        </div>
        <div class="hint" id="kbmode-desc"></div>
        <div class="actions">
          <button class="primary" id="detectbtn">Detect local server</button>
          <button id="connectbtn">Connect / Refresh models</button>
          <button id="savekey">Save settings</button>
        </div>
        <div class="hint" id="server-info"></div>
      </div>

      <div class="chat-log" id="chatlog"></div>
      <div class="chat-input-row">
        <textarea id="chatinput" placeholder="Ask anything about local LLMs — e.g. 'Why does my 13B model crash at 32K context?'"></textarea>
        <button id="chatsend">Send</button>
      </div>
    `;
    root.appendChild(wrap);

    function setStatus(state, label) {
      const badge = $("#conn-status");
      badge.className = "conn-badge " + state;
      badge.textContent = label;
    }

    // Returns true when models were populated, false when the list was empty.
    // Callers should NOT overwrite the server-info message when this returns false —
    // the "no models found" message we set here should stand.
    function populateModels(modelList, selected) {
      const sel = $("#modelsel");
      if (!modelList || modelList.length === 0) {
        sel.innerHTML = `<option value="">(no models loaded on server)</option>`;
        // Clear any stale stored model — otherwise chat would send a model ID
        // that the server no longer knows about.
        window.CHAT.setModel("");
        $("#server-info").innerHTML = `<span style="color:var(--err-bd);">No models found at this endpoint. Load a model in your server first.</span>`;
        return false;
      }
      sel.innerHTML = modelList.map(id => {
        const isSel = (id === selected) || (id === window.CHAT.getModel());
        return `<option value="${esc(id)}" ${isSel ? "selected" : ""}>${esc(id)}</option>`;
      }).join("");
      // If saved model isn't in the list, default to first
      if (!modelList.includes(window.CHAT.getModel())) {
        window.CHAT.setModel(modelList[0]);
      }
      return true;
    }

    async function refreshStatus() {
      setStatus("checking", "checking…");
      const r = await window.CHAT.status();
      if (r.ok) {
        const name = r.name || "OpenAI-compatible server";
        setStatus("ok", "✓ " + name);
        const hadModels = populateModels(r.models);
        if (hadModels) {
          $("#server-info").innerHTML = `Connected to <strong>${esc(name)}</strong> at <code>${esc(r.url)}</code> — ${r.models.length} model${r.models.length === 1 ? "" : "s"} available.`;
        }
        // If hadModels is false, populateModels already set a "no models found" message and cleared the stored model — leave it.
      } else {
        setStatus("bad", "✗ unreachable");
        $("#server-info").innerHTML = `Could not reach <code>${esc(window.CHAT.getEndpoint())}</code> (${esc(r.error || "no response")}). Try <strong>Detect local server</strong>, or start a server using the quickstart above.`;
      }
    }

    async function detect() {
      setStatus("checking", "scanning common ports…");
      $("#server-info").textContent = "Probing localhost:1234 (LM Studio), :11434 (Ollama), :8080 (llama.cpp), :1337 (Jan), :8000 (vLLM), :5000 (TGW), :4891 (GPT4All)…";
      const r = await window.CHAT.detect();
      if (r) {
        window.CHAT.setEndpoint(r.url);
        $("#endpoint").value = r.url;
        const name = r.name || "OpenAI-compatible server";
        setStatus("ok", "✓ " + name);
        const hadModels = populateModels(r.models);
        if (hadModels) {
          $("#server-info").innerHTML = `Detected <strong>${esc(name)}</strong> at <code>${esc(r.url)}</code> — ${r.models.length} model${r.models.length === 1 ? "" : "s"} available.`;
        }
        // If hadModels is false, populateModels already set a "no models found" message — leave it.
      } else {
        setStatus("bad", "✗ nothing found");
        $("#server-info").innerHTML = `No local server detected on any common port. See the quickstart above to start one. (If your server is on a non-default port, type the endpoint manually and hit <em>Connect</em>.)`;
      }
    }

    $("#detectbtn").addEventListener("click", detect);
    $("#connectbtn").addEventListener("click", refreshStatus);
    $("#endpoint").addEventListener("input", e => { window.CHAT.setEndpoint(e.target.value); });
    $("#apikey").addEventListener("input",   e => { window.CHAT.setKey(e.target.value); });
    $("#modelsel").addEventListener("change", e => { window.CHAT.setModel(e.target.value); });
    $("#savekey").addEventListener("click", () => {
      window.CHAT.setEndpoint($("#endpoint").value);
      window.CHAT.setKey($("#apikey").value);
      window.CHAT.setModel($("#modelsel").value);
      $("#savedmark").textContent = "Saved";
      setTimeout(() => { $("#savedmark").textContent = ""; }, 1500);
    });

    $("#chatsend").addEventListener("click", sendChat);
    $("#chatinput").addEventListener("keydown", e => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendChat(); }
    });

    // Live KB-mode wiring: keep the settings selector, the inline estimate,
    // the description hint, and the guidance-panel size hint all in sync.
    function fmtTokens(n) {
      if (!n) return "0";
      if (n < 1000) return "~" + n;
      return "~" + Math.round(n / 100) * 100 / 1000 + "K";
    }
    function syncKbMode() {
      const mode = window.CHAT.getKbMode();
      const modes = window.CHAT.kbModes();
      const meta = modes.find(m => m.id === mode) || modes[0];
      // Per-mode estimate — for retrieve/current the actual size varies per
      // query/route, so we show a representative number using an empty query.
      const tokens = window.CHAT.estimateTokensForMode(mode, "");
      const estLabel = (mode === "retrieve") ? "varies per query — empty: " + fmtTokens(tokens)
                      : (mode === "current")  ? "depends on current lesson — fallback: " + fmtTokens(tokens)
                      : fmtTokens(tokens);
      if ($("#kb-est"))         $("#kb-est").textContent = estLabel;
      if ($("#kbmode-desc"))    $("#kbmode-desc").textContent = meta.hint;
      if ($("#kb-tokens"))      $("#kb-tokens").textContent = estLabel;
      if ($("#kb-mode-label"))  $("#kb-mode-label").textContent = meta.label.split(" — ")[0];
    }
    if ($("#kbmode")) {
      $("#kbmode").addEventListener("change", e => {
        window.CHAT.setKbMode(e.target.value);
        syncKbMode();
      });
    }
    syncKbMode();

    // Suggested-prompt chips fill the textarea on click
    const SUGGESTED_PROMPTS = [
      "Why does my 13B model crash at 32K context?",
      "Explain KV cache in one sentence.",
      "What's the difference between MHA and GQA?",
      "When should I use RAG vs long context?",
      "Recommend a setup for a 24 GB GPU."
    ];
    const chips = $("#suggest-chips");
    if (chips) {
      SUGGESTED_PROMPTS.forEach(p => {
        const b = document.createElement("button");
        b.className = "suggest-chip";
        b.textContent = p;
        b.addEventListener("click", () => {
          $("#chatinput").value = p;
          $("#chatinput").focus();
        });
        chips.appendChild(b);
      });
    }

    paintChatLog();
    refreshStatus();
  }

  // Look up a lesson's human-readable title by ID
  function lessonTitle(id) {
    for (const mod of (window.COURSE && window.COURSE.modules) || []) {
      for (const lesson of mod.lessons) {
        if (lesson.id === id) return lesson.title;
      }
    }
    return null;
  }

  // Escape HTML, then turn lesson IDs (m1l1, m6l10, …) into clickable links
  // labelled with the lesson's actual title — so the user sees "KV Cache",
  // not "m1l5".
  function escCite(text) {
    return esc(text).replace(/\b(m\d+l\d+)\b/g, (m, id) => {
      const title = lessonTitle(id);
      if (!title) return m;  // not a real lesson — leave the text alone
      return `<a class="cite" href="#/course/${id}">${esc(title)}</a>`;
    });
  }

  function paintChatLog() {
    const log = $("#chatlog");
    if (!log) return;
    if (state.chat.messages.length === 0) {
      log.innerHTML = `<div class="msg" style="color:var(--text-mute);">No messages yet. Try: <em>"What's the difference between prefill and decode?"</em></div>`;
      return;
    }
    log.innerHTML = state.chat.messages.map(m => {
      const cls = "msg " + m.role + (m.pending ? " pending" : "") + (m.error ? " error" : "");
      const roleLabel = m.role === "user" ? "You" : m.role === "assistant" ? "Assistant" : "System";
      const body = (m.role === "assistant" && !m.error) ? escCite(m.content) : esc(m.content);
      return `<div class="${cls}">
        <div class="role">${roleLabel}</div>
        <div class="body">${body}</div>
      </div>`;
    }).join("");
    log.scrollTop = log.scrollHeight;
  }

  async function sendChat() {
    const input = $("#chatinput");
    const text = input.value.trim();
    if (!text) return;
    if (!window.CHAT.getModel()) {
      state.chat.messages.push({
        role: "system",
        content: "No model selected. Click 'Detect local server' or pick a model after connecting.",
        error: true
      });
      paintChatLog();
      return;
    }
    state.chat.messages.push({ role: "user", content: text });
    state.chat.messages.push({ role: "assistant", content: "Thinking…", pending: true });
    input.value = "";
    $("#chatsend").disabled = true;
    paintChatLog();

    const apiMessages = state.chat.messages
      .filter(m => (m.role === "user" || m.role === "assistant") && !m.pending && !m.error)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await window.CHAT.send(apiMessages);
      const last = state.chat.messages[state.chat.messages.length - 1];
      last.content = res.text || "(empty response)";
      last.pending = false;
    } catch (err) {
      const last = state.chat.messages[state.chat.messages.length - 1];
      last.content = err.message || String(err);
      last.pending = false;
      last.error = true;
    } finally {
      $("#chatsend").disabled = false;
      paintChatLog();
    }
  }
})();
