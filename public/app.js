const form = document.getElementById("builderForm");
const output = document.getElementById("output");
const businessType = document.getElementById("businessType");
const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const quickActions = document.getElementById("quickActions");
const simName = document.getElementById("simName");
const simMeta = document.getElementById("simMeta");
const publishButton = document.getElementById("publishButton");
const publishOutput = document.getElementById("publishOutput");
const submitButton = document.getElementById("generateBtn");
const copyConfigBtn = document.getElementById("copyConfigBtn");

const isLocal =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";
let backendUrl = isLocal ? "" : "https://own-chatbot-agent-2wb7.onrender.com";
if (window.location.hostname.includes("github.io")) {
  backendUrl =
    localStorage.getItem("chatbot_backend_url") ||
    "https://own-chatbot-agent-2wb7.onrender.com";
  const notice = document.getElementById("backendNotice");
  if (notice) notice.style.display = "flex";
  const btn = document.getElementById("setBackend");
  if (btn) {
    btn.addEventListener("click", () => {
      const url = prompt(
        "Enter your Render/Railway backend URL (e.g., https://my-bot.onrender.com):",
        backendUrl,
      );
      if (url !== null) {
        localStorage.setItem("chatbot_backend_url", url.trim());
        window.location.reload();
      }
    });
  }
}

let currentProfile = null;
let currentBot = null;
let conversation = [];

// ── Publish step tracker ──
function setPublishStep(step, status) {
  // step: 1|2|3, status: 'pending'|'active'|'done'
  const el = document.getElementById("pStep" + step);
  const badge = document.getElementById("pStep" + step + "Badge");
  if (!el || !badge) return;
  el.className =
    "publish-step" +
    (status === "done"
      ? " step-done"
      : status === "active"
        ? " step-active"
        : "");
  badge.className = "pstep-badge pstep-" + status;
  badge.textContent =
    status === "done" ? "Done" : status === "active" ? "Ready" : "Pending";
}

const localTemplates = {
  real_estate: {
    label: "Real Estate",
    tone: "professional, helpful, and conversion-focused",
    goals: ["capture leads", "answer property questions", "book viewings"],
    knowledgeHints: [
      "property listings",
      "pricing",
      "loan guidance",
      "contact details",
    ],
  },
  ecommerce: {
    label: "Ecommerce",
    tone: "friendly, concise, and sales-oriented",
    goals: [
      "answer product questions",
      "recommend products",
      "reduce support load",
    ],
    knowledgeHints: [
      "product catalog",
      "shipping policy",
      "return policy",
      "promotions",
    ],
  },
  clinic: {
    label: "Clinic / Healthcare",
    tone: "calm, professional, and reassuring",
    goals: [
      "book appointments",
      "answer service questions",
      "share clinic details",
    ],
    knowledgeHints: ["services", "pricing", "timings", "doctor profiles"],
  },
  saas: {
    label: "SaaS",
    tone: "clear, technical, and support-friendly",
    goals: ["qualify leads", "answer product questions", "support onboarding"],
    knowledgeHints: ["pricing", "features", "documentation", "onboarding"],
  },
  restaurant: {
    label: "Restaurant",
    tone: "warm, quick, and welcoming",
    goals: ["share menu", "take reservations", "answer timing questions"],
    knowledgeHints: ["menu", "hours", "location", "delivery policy"],
  },
  generic: {
    label: "General Business",
    tone: "helpful, friendly, and adaptable",
    goals: [
      "answer website questions",
      "capture leads",
      "route complex issues",
    ],
    knowledgeHints: ["about page", "FAQ", "contact details", "policies"],
  },
};

const templatePrompts = {
  real_estate: [
    "Do you have 2BHK apartments?",
    "Can I book a site visit?",
    "What is the starting price?",
  ],
  ecommerce: [
    "Do you have this in stock?",
    "What is your return policy?",
    "Do you deliver nationwide?",
  ],
  clinic: [
    "Can I book an appointment?",
    "What are your timings?",
    "Do you offer consultation for skin care?",
  ],
  saas: [
    "How does this product work?",
    "What plans do you offer?",
    "Can I book a demo?",
  ],
  restaurant: [
    "What is on your menu?",
    "Do you take table reservations?",
    "Are you open today?",
  ],
  generic: [
    "What services do you offer?",
    "How can I contact your team?",
    "Do you have pricing details?",
  ],
};

// Populate dropdown immediately from local data
if (businessType) {
  businessType.innerHTML = Object.entries(localTemplates)
    .map(
      ([key, value], index) =>
        `<option value="${key}" ${index === 0 ? "selected" : ""}>${value.label}</option>`,
    )
    .join("");
  syncQuickActions(businessType.value);
}

// Sync dropdown with backend templates in background (no profile generation)
(async function syncTemplates() {
  try {
    const data = await callApi("/api/templates");
    if (!data || !data.templates || !data.templates.length) return;
    const currentVal = businessType.value;
    businessType.innerHTML = data.templates
      .map(
        (item) =>
          `<option value="${item.key}" ${item.key === currentVal ? "selected" : ""}>${item.label}</option>`,
      )
      .join("");
  } catch {
    // keep local templates
  }
})();

// Show initial ready state — no auto-generation, wait for user to fill form
showReadyState();

submitButton.addEventListener("click", async () => {
  await generateProfile();
});

if (publishButton) {
  publishButton.addEventListener("click", async () => {
    if (!currentProfile) return;

    publishButton.disabled = true;
    publishButton.textContent = currentBot
      ? "Updating chatbot..."
      : "Publishing chatbot...";
    publishOutput.textContent = "Publishing your chatbot...";

    try {
      const data = await callApi("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: currentProfile,
          botId: currentBot?.id,
        }),
      });

      if (!data) throw new Error("Publish request failed");

      currentBot = data;
      currentProfile = {
        ...currentProfile,
        botId: data.id,
        publishUrl: data.publicUrl,
        embedUrl: data.embedUrl,
      };

      if (output) output.textContent = JSON.stringify(currentProfile, null, 2);
      renderPublishOutput(data);
      setPublishStep(3, "done");
    } catch (error) {
      publishOutput.textContent = `Could not publish chatbot: ${error.message}`;
    } finally {
      publishButton.disabled = false;
      publishButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ${currentBot ? "Update chatbot" : "Publish chatbot"}`;
    }
  });
}

if (copyConfigBtn) {
  copyConfigBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation(); // don't toggle the <details>
    const text = output?.textContent || "{}";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    copyConfigBtn.classList.add("copied");
    const svg = copyConfigBtn.querySelector("svg");
    copyConfigBtn.innerHTML = (svg ? svg.outerHTML : "") + " Copied!";
    setTimeout(() => {
      copyConfigBtn.classList.remove("copied");
      copyConfigBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
    }, 2000);
  });
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;

  if (!currentProfile) {
    addMessage(
      "system",
      "Please generate a chatbot profile first using the form on the left.",
    );
    return;
  }
  // Mark step 2 done after first real chat message
  setPublishStep(2, "done");
  setPublishStep(3, "active");

  chatInput.value = "";
  addMessage("user", message);
  conversation.push({ role: "user", content: message });

  const typingId = addTyping();

  try {
    const data = (await callApi("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, profile: currentProfile, conversation }),
    })) || {
      reply: generateLocalReply(message, currentProfile, conversation),
      provider: "static",
    };

    removeTyping(typingId);
    const reply = data.reply || "I could not generate a response right now.";
    addMessage("bot", reply);
    conversation.push({ role: "assistant", content: reply });
  } catch {
    removeTyping(typingId);
    addMessage(
      "bot",
      "I could not reach the chatbot API right now. Please check the server and Groq key.",
    );
  }

  scrollChatToBottom();
});

quickActions.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-prompt]");
  if (!button) return;
  chatInput.value = button.dataset.prompt;
  chatForm.requestSubmit();
});

businessType.addEventListener("change", () => {
  syncQuickActions(businessType.value);
});

// ─── Knowledge Base drop zone ─────────────────────────────────────────────────

(function initKnowledgeDropZone() {
  const dropZone = document.getElementById("kzDropZone");
  const fileInput = document.getElementById("kzFileInput");
  const idleEl = document.getElementById("kzIdle");
  const loadedEl = document.getElementById("kzLoaded");
  const fileNameEl = document.getElementById("kzFileName");
  const charCountEl = document.getElementById("kzCharCount");
  const clearBtn = document.getElementById("kzClear");
  const textarea = document.getElementById("manualKnowledge");
  if (!dropZone || !fileInput || !textarea) return;

  function showLoaded(name, text) {
    textarea.value = text;
    fileNameEl.textContent = name;
    charCountEl.textContent = `${text.length.toLocaleString()} characters extracted`;
    idleEl.style.display = "none";
    loadedEl.style.display = "flex";
  }

  function reset() {
    textarea.value = "";
    idleEl.style.display = "flex";
    loadedEl.style.display = "none";
    fileInput.value = "";
  }

  clearBtn.addEventListener("click", reset);

  async function handleFile(file) {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "txt" || ext === "md" || ext === "markdown") {
      const text = await file.text();
      showLoaded(file.name, text.trim());
      return;
    }

    if (ext === "docx" || ext === "doc") {
      charCountEl.textContent = "Extracting Word document…";
      idleEl.style.display = "none";
      loadedEl.style.display = "flex";
      fileNameEl.textContent = file.name;
      try {
        const text = await extractDocxText(file);
        showLoaded(file.name, text.trim());
      } catch {
        reset();
        alert(
          "Could not read this Word file. Try saving it as .txt or paste the content instead.",
        );
      }
      return;
    }

    if (ext === "pdf") {
      charCountEl.textContent = "Extracting PDF…";
      idleEl.style.display = "none";
      loadedEl.style.display = "flex";
      fileNameEl.textContent = file.name;
      try {
        const text = await extractPdfText(file);
        showLoaded(file.name, text.trim());
      } catch {
        reset();
        alert("Could not read this PDF. Try copy-pasting the text instead.");
      }
      return;
    }

    alert(
      "Supported formats: PDF, DOCX, TXT, MD. Please drop one of those or paste your content below.",
    );
  }

  // Drag & drop
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", (e) => {
    dropZone.classList.remove("drag-over");
  });
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    handleFile(e.dataTransfer.files[0]);
  });

  // Click to browse
  dropZone.addEventListener("click", (e) => {
    if (e.target.closest("#kzClear")) return;
    fileInput.click();
  });
  fileInput.addEventListener("change", () => handleFile(fileInput.files[0]));

  // DOCX text extraction using Mammoth.js (loaded from CDN on demand)
  async function extractDocxText(file) {
    if (!window.mammoth) {
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js",
      );
    }
    const arrayBuffer = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  // PDF text extraction using PDF.js (loaded from CDN on demand)
  async function extractPdfText(file) {
    if (!window.pdfjsLib) {
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
      );
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer })
      .promise;
    const parts = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      parts.push(content.items.map((item) => item.str).join(" "));
    }
    return parts.join("\n\n");
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
})();

// ─── Core profile generation ──────────────────────────────────────────────────

async function generateProfile() {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  const hasWebsiteUrl = String(payload.websiteUrl || "").trim().length > 0;

  // Lock button and show progress
  submitButton.disabled = true;
  submitButton.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin .8s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> ${hasWebsiteUrl ? "Scraping website..." : "Generating profile..."}`;
  output.textContent = hasWebsiteUrl
    ? `Reading ${payload.websiteUrl} and building your chatbot profile...`
    : "Building chatbot profile from your inputs...";
  simMeta.textContent = hasWebsiteUrl
    ? "Fetching website content..."
    : "Generating...";

  // Show progress in chat while waiting
  chatWindow.innerHTML = "";
  addMessage(
    "system",
    hasWebsiteUrl
      ? `Reading ${payload.websiteUrl}... this may take up to 15 seconds.`
      : "Generating your chatbot profile...",
  );

  try {
    const data =
      (await callApi("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, forceRefresh: true }),
      })) || buildLocalProfile(payload);

    currentProfile = data;
    currentBot = null;

    // Show generated config
    output.textContent = JSON.stringify(currentProfile, null, 2);

    // Update simulator header
    simName.textContent = currentProfile.projectName || "Website Assistant";

    const goodChunks = (data.websiteChunks || []).filter((c) => {
      const t = (c.text || "").trim();
      return t.length > 40 && t.toLowerCase() !== "section";
    });
    const hasWebContent =
      goodChunks.length > 0 ||
      (data.websiteSections || []).some(
        (s) => (s.text || s.description || "").trim().length > 40,
      ) ||
      (data.websiteSummary || "").length > 100;

    const sourceLabel = hasWebContent
      ? `${data.websitePages?.length || 0} page${(data.websitePages?.length || 0) !== 1 ? "s" : ""} scraped`
      : payload.websiteUrl
        ? "profile generated (form inputs)"
        : "no website provided";

    simMeta.textContent = `${currentProfile.businessType} | ${currentProfile.tone} | ${sourceLabel}`;

    // Show welcome in chat
    chatWindow.innerHTML = "";
    const welcome = `Hi, I'm ${currentProfile.projectName || "your chatbot"}. Ask me anything!`;
    addMessage("bot", welcome);
    conversation = [{ role: "assistant", content: welcome }];

    // Show scrape quality warning if needed
    const scrapeQuality = data._scrapeQuality;
    const hasManualContent = (payload.manualKnowledge || "").trim().length > 0;
    const existingWarning = document.getElementById("scrapeWarning");
    if (existingWarning) existingWarning.remove();

    if (payload.websiteUrl && !hasManualContent && (scrapeQuality === "partial" || scrapeQuality === "failed")) {
      const warning = document.createElement("div");
      warning.id = "scrapeWarning";
      warning.style.cssText = "background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;padding:12px 14px;margin-bottom:12px;font-size:.82rem;color:#92400e;line-height:1.5;";
      warning.innerHTML = scrapeQuality === "failed"
        ? `⚠️ <strong>Couldn't read your website</strong> — it's likely a JavaScript SPA (React/Vue/Angular) whose content only loads in a browser. For accurate answers, paste your content (about, services, FAQs, etc.) in the <strong>Knowledge Base</strong> field above and regenerate.`
        : `⚠️ <strong>Website partially read</strong> — some content may be missing (tabs, dynamic sections). For best results, paste your full content in the <strong>Knowledge Base</strong> field above and regenerate.`;

      const knowledgeField = document.getElementById("manualKnowledge");
      if (knowledgeField) {
        knowledgeField.closest(".field-group").insertAdjacentElement("afterend", warning);
        knowledgeField.scrollIntoView({ behavior: "smooth", block: "center" });
        knowledgeField.style.border = "1.5px solid #f59e0b";
      }
    } else {
      // Reset textarea border if previously highlighted
      const kb = document.getElementById("manualKnowledge");
      if (kb) kb.style.border = "";
    }

    syncQuickActions(payload.businessType);
    renderPublishPrompt();
    scrollChatToBottom();
    // Mark steps
    setPublishStep(1, "done");
    setPublishStep(2, "active");
    setPublishStep(3, "pending");
  } catch (error) {
    currentProfile = null;
    output.textContent = `Error: ${error.message}`;
    simMeta.textContent = "Failed to generate profile";
    chatWindow.innerHTML = "";
    addMessage("system", `Could not generate profile: ${error.message}`);
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4.5 13.5H11L10 22L19.5 10H13L13 2Z"/></svg> Generate chatbot profile`;
    if (publishButton) {
      publishButton.disabled = !currentProfile;
      publishButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Publish chatbot`;
    }
  }
}

function showReadyState() {
  output.textContent =
    'Fill in the form and click "Generate chatbot profile" to get started.';
  simName.textContent = "Website Assistant";
  simMeta.textContent = "Ready — waiting for profile";
  chatWindow.innerHTML = "";
  addMessage(
    "bot",
    "Hi! Fill in your website URL and business details on the left, then click Generate chatbot profile.",
  );
  addMessage(
    "system",
    "Your chatbot will be trained on your website content and ready to answer questions here.",
  );
  renderPublishPrompt();
  if (publishButton) publishButton.disabled = true;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function syncQuickActions(type) {
  const prompts = templatePrompts[type] || templatePrompts.generic;
  quickActions.innerHTML = prompts
    .map(
      (prompt) =>
        `<button type="button" data-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`,
    )
    .join("");
}

function renderPublishPrompt(message = "") {
  if (!publishOutput) return;
  publishOutput.className = "publish-output-area";
  if (message) {
    publishOutput.innerHTML = `<div class="publish-empty-state"><p style="color:#ef4444">Error: ${escapeHtml(message)}</p></div>`;
  } else {
    publishOutput.innerHTML = `<div class="publish-empty-state">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="publish-empty-icon"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/></svg>
      <p>Complete steps 1 &amp; 2 first,<br>then publish to go live.</p>
    </div>`;
  }
}

function renderPublishOutput(bot) {
  if (!publishOutput) return;
  const shareUrl = bot.publicUrl || bot.shareUrl || "";
  const embedBuilderUrl = bot.embedBuilderUrl || "";
  const embedScript = bot.embedScript || "";
  const embedIframe = bot.embedIframe || "";

  publishOutput.className = "publish-output-area";
  publishOutput.innerHTML = `
    <div class="publish-success">
      <div class="publish-success-header">
        <div class="publish-success-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div>
          <div class="publish-success-title">Bot published successfully!</div>
          <div class="publish-success-subtitle">Your chatbot is now live and ready to embed.</div>
        </div>
      </div>

      <div class="publish-meta-row">
        <span class="publish-label">Bot ID</span>
        <span class="bot-id-pill">${escapeHtml(bot.id || "")}</span>
      </div>

      ${
        shareUrl
          ? `<div class="publish-meta-row">
        <span class="publish-label">Share URL</span>
        <a href="${escapeHtml(shareUrl)}" target="_blank" rel="noreferrer" class="share-url-link">
          ${escapeHtml(shareUrl)}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      </div>`
          : ""
      }

      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${
          embedBuilderUrl
            ? `<a href="${escapeHtml(embedBuilderUrl)}" target="_blank" rel="noreferrer" class="btn-customize">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Customize &amp; Embed
        </a>`
            : ""
        }
        ${
          bot.id
            ? `<a href="/widget-builder?botId=${escapeHtml(bot.id)}" target="_blank" rel="noreferrer" class="btn-customize" ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
          Widget Builder
        </a>`
            : ""
        }
      </div>

      ${
        embedScript || embedIframe
          ? `<details class="embed-snippets-details">
        <summary class="embed-snippets-summary">
          Quick embed snippets
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </summary>
        <div class="embed-snippets-body">
          ${embedScript ? `<label class="snippet-label">Embed script<textarea readonly rows="3">${escapeHtml(embedScript)}</textarea></label>` : ""}
          ${embedIframe ? `<label class="snippet-label">Embed iframe<textarea readonly rows="3">${escapeHtml(embedIframe)}</textarea></label>` : ""}
        </div>
      </details>`
          : ""
      }
    </div>
  `;
}

function addMessage(role, text) {
  const row = document.createElement("div");
  row.className = `message ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  row.appendChild(bubble);
  chatWindow.appendChild(row);
  scrollChatToBottom();
}

function addTyping() {
  const id = `typing-${Date.now()}`;
  const row = document.createElement("div");
  row.className = "message bot";
  row.dataset.typingId = id;
  const bubble = document.createElement("div");
  bubble.className = "bubble typing-indicator";
  bubble.innerHTML = `<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>`;
  row.appendChild(bubble);
  chatWindow.appendChild(row);
  scrollChatToBottom();
  return id;
}

function removeTyping(id) {
  const row = chatWindow.querySelector(`[data-typing-id="${id}"]`);
  if (row) row.remove();
}

function escapeHtml(value) {
  return String(value || "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}

function scrollChatToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function loadTemplates() {
  try {
    const data = await callApi("/api/templates");
    if (!data || !data.templates) throw new Error("Invalid template data");
    return data;
  } catch {
    return {
      templates: Object.entries(localTemplates).map(([key, value]) => ({
        key,
        label: value.label,
      })),
    };
  }
}

async function callApi(path, options) {
  try {
    const fullPath = backendUrl
      ? `${backendUrl.replace(/\/$/, "")}${path}`
      : path;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    const response = await fetch(fullPath, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await response.json();
    if (!response.ok || data?.error) {
      throw new Error(
        data?.error || `Request failed with status ${response.status}`,
      );
    }
    return data;
  } catch (error) {
    console.error("API Call failed:", error.message);
    return null;
  }
}

// ─── Local fallback profile ───────────────────────────────────────────────────

function buildLocalProfile(payload) {
  const template =
    localTemplates[payload.businessType] || localTemplates.generic;
  const projectName = payload.projectName || `${template.label} Chatbot`;
  const goals = compact([payload.mainGoal, ...template.goals]);
  const knowledgeSources = compact([
    payload.websiteUrl && `Website: ${payload.websiteUrl}`,
    payload.uploadedDocs && `Uploaded docs: ${payload.uploadedDocs}`,
    ...template.knowledgeHints.map((hint) => `Business knowledge: ${hint}`),
  ]);
  const leadCaptureFields = compact([
    payload.capturesName === "yes" && "name",
    payload.capturesEmail === "yes" && "email",
    payload.capturesPhone === "yes" && "phone",
  ]);
  const handoffConditions = compact([
    payload.handoffReason ||
      "The user asks for something outside the knowledge base.",
    "The user requests a human representative.",
    "The bot is uncertain about the answer.",
  ]);
  return {
    projectName,
    businessType: template.label,
    websiteUrl: payload.websiteUrl || "",
    websiteTitle: "",
    websiteSummary: "",
    websitePages: [],
    websiteSections: [],
    websiteChunks: [],
    websiteTopics: [],
    tone: payload.tone || template.tone,
    goals,
    targetAudience: payload.targetAudience || "website visitors",
    knowledgeSources,
    leadCaptureFields,
    handoffConditions,
    allowedTopics: compact([
      payload.allowedTopics,
      "business services",
      "pricing or packages",
      "basic support",
    ]),
    blockedTopics: compact([
      payload.blockedTopics,
      "legal advice",
      "medical diagnosis",
      "financial guarantees",
    ]),
    prompt: [
      `You are the AI chatbot for ${projectName}.`,
      `Business type: ${template.label}.`,
      `Tone: ${payload.tone || template.tone}.`,
      `Primary goals: ${goals.join(", ")}.`,
      `Knowledge sources: ${knowledgeSources.join(", ")}.`,
      `Capture lead fields only when useful: ${leadCaptureFields.join(", ") || "none"}.`,
      `Hand off to a human when: ${handoffConditions.join(" | ")}.`,
      "Be accurate, concise, and friendly.",
      "If a question cannot be answered confidently, say so and offer a handoff.",
    ].join("\n"),
    provider: "static",
  };
}

function generateLocalReply(message, profile, history) {
  const text = String(message || "").toLowerCase();
  const name = profile?.projectName || "this chatbot";
  if (text.includes("price") || text.includes("pricing"))
    return `${name} can help with pricing guidance — ask a specific question for details.`;
  if (text.includes("hello") || text.includes("hi"))
    return `Hi, I'm ${name}. How can I help today?`;
  if (
    text.includes("contact") ||
    text.includes("email") ||
    text.includes("phone")
  )
    return `I can help route you to the right contact details for ${profile?.businessType || "this business"}.`;
  return `I'm your AI assistant for ${profile?.businessType || "this business"}. Ask me about ${profile?.goals?.[0] || "our services"}.`;
}

function compact(values) {
  return [...new Set((values.flat ? values.flat() : values).filter(Boolean))];
}

// ─── Sidebar navigation ───────────────────────────────────────────────────────

document.querySelectorAll(".nav-item[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

function switchView(viewId) {
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  document.getElementById("view-" + viewId)?.classList.add("active");
  document
    .querySelector(`.nav-item[data-view="${viewId}"]`)
    ?.classList.add("active");

  if (viewId === "bots") loadBotsView();

  // Update topbar title/subtitle
  const titles = { create: "Create Bot", bots: "My Bots" };
  const subs = {
    create: "Train an AI chatbot on your website in minutes",
    bots: "Manage and embed your published chatbots",
  };
  const pageTitleEl = document.getElementById("pageTitle");
  const pageSubEl = document.getElementById("pageSubtitle");
  if (pageTitleEl) pageTitleEl.textContent = titles[viewId] || "";
  if (pageSubEl) pageSubEl.textContent = subs[viewId] || "";

  // Show/hide refresh button
  const refreshBtn = document.getElementById("refreshBotsBtn");
  if (refreshBtn) {
    refreshBtn.classList.toggle("hidden", viewId !== "bots");
  }

  // Close sidebar on mobile after navigation
  closeSidebar();
}

// ─── My Bots view ─────────────────────────────────────────────────────────────

async function loadBotsView() {
  const grid = document.getElementById("botsGrid");
  if (!grid) return;

  // Show skeleton loader
  grid.innerHTML = `<div class="bots-loading">
    ${[1, 2, 3]
      .map(
        () => `<div class="skeleton-card">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div class="skeleton-line tall"></div>
        <div class="skeleton-line short" style="height:20px;width:60px;border-radius:999px;"></div>
      </div>
      <div class="skeleton-line medium"></div>
      <div class="skeleton-line short" style="height:20px;width:70px;border-radius:999px;"></div>
      <div class="skeleton-line short"></div>
      <div style="display:flex;gap:8px;">
        <div class="skeleton-line" style="height:32px;flex:1;"></div>
        <div class="skeleton-line" style="height:32px;flex:1;"></div>
      </div>
    </div>`,
      )
      .join("")}
  </div>`;

  const data = await callApi("/api/bots");
  const bots = data?.bots || [];

  if (!bots.length) {
    grid.innerHTML = `<div class="bots-empty">
      <div class="bots-empty-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4.5 13.5H11L10 22L19.5 10H13L13 2Z"/></svg>
      </div>
      <h3 class="bots-empty-title">No bots yet</h3>
      <p class="bots-empty-sub">Create your first bot by switching to the Create Bot tab and generating a profile.</p>
      <button type="button" class="btn-create-first" onclick="switchView('create')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Create your first bot
      </button>
    </div>`;
    return;
  }

  grid.innerHTML = bots.map((bot) => renderBotCard(bot)).join("");
  applyCardTilt();
}

function renderBotCard(bot) {
  const name = bot.projectName || "Untitled";
  const color = botAvatarColor(name);
  const date = timeAgo(new Date(bot.createdAt));
  return `<div class="bot-card">
    <div class="bot-card-top">
      <div class="bot-avatar" style="background:${color}">${escapeHtml(name[0].toUpperCase())}</div>
      <span class="status-badge">Published</span>
    </div>
    <h3 class="bot-card-name">${escapeHtml(name)}</h3>
    <div class="bot-card-type">${escapeHtml(bot.businessType || "General")}</div>
    <div class="bot-card-date">${date}</div>
    <div class="bot-card-actions">
      <a href="/bot/${bot.id}" target="_blank" class="btn-outline-sm">Test Chat</a>
      <a href="/embed-builder/${bot.id}" target="_blank" class="btn-primary-sm">Embed</a>
      <a href="/widget-builder?botId=${bot.id}" target="_blank" class="btn-outline-sm" style="margin-top:6px;display:flex;align-items:center;gap:5px;">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
        Widget Builder
      </a>
    </div>
  </div>`;
}

function timeAgo(date) {
  const diff = Date.now() - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function botAvatarColor(name) {
  const colors = [
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#06b6d4",
    "#3b82f6",
  ];
  return colors[(name || "A").charCodeAt(0) % colors.length];
}

// ─── Refresh bots button ──────────────────────────────────────────────────────

const refreshBotsBtn = document.getElementById("refreshBotsBtn");
if (refreshBotsBtn) {
  refreshBotsBtn.addEventListener("click", () => loadBotsView());
}

// ─── Mobile sidebar toggle ────────────────────────────────────────────────────

const hamburger = document.getElementById("hamburger");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");

function openSidebar() {
  sidebar?.classList.add("open");
  sidebarOverlay?.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeSidebar() {
  sidebar?.classList.remove("open");
  sidebarOverlay?.classList.remove("active");
  document.body.style.overflow = "";
}

if (hamburger) {
  hamburger.addEventListener("click", () => {
    if (sidebar?.classList.contains("open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });
}

if (sidebarOverlay) {
  sidebarOverlay.addEventListener("click", closeSidebar);
}

// ─── Spin keyframe (for loading button state) ────────────────────────────────
const spinStyle = document.createElement("style");
spinStyle.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(spinStyle);

// ─── Canvas dot grid background (light version) ──────────────────────────────
(function initCanvas() {
  const canvas = document.getElementById("bgCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W,
    H,
    dots = [];
  const DOT_COUNT = 70,
    SPEED = 0.25,
    CONNECT_DIST = 130;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function createDot() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * SPEED,
      vy: (Math.random() - 0.5) * SPEED,
    };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      d.x += d.vx;
      d.y += d.vy;
      if (d.x < 0 || d.x > W) d.vx *= -1;
      if (d.y < 0 || d.y > H) d.vy *= -1;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(79,70,229,0.55)";
      ctx.fill();
      for (let j = i + 1; j < dots.length; j++) {
        const d2 = dots[j];
        const dist = Math.hypot(d.x - d2.x, d.y - d2.y);
        if (dist < CONNECT_DIST) {
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d2.x, d2.y);
          ctx.strokeStyle = `rgba(79,70,229,${0.18 * (1 - dist / CONNECT_DIST)})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  resize();
  dots = Array.from({ length: DOT_COUNT }, createDot);
  draw();
})();

// ─── 3D card tilt ─────────────────────────────────────────────────────────────
function applyCardTilt() {
  document.querySelectorAll(".bot-card").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(600px) rotateX(${(-y * 10).toFixed(2)}deg) rotateY(${(x * 10).toFixed(2)}deg) translateZ(6px)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
}

// ─── Mascot Robot (CSS — Three.js removed) ───────────────────────────────────
(function initRobotCanvas() {
  try {
    const canvas = document.getElementById("orbCanvas");
    if (!canvas) return; // canvas removed, nothing to do

    const W = 180,
      H = 220;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputEncoding = THREE.sRGBEncoding;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
    camera.position.set(0, 0.85, 6.0);
    camera.lookAt(0, 0.7, 0);

    // ── Studio lighting ──
    scene.add(new THREE.AmbientLight(0xfff8f0, 0.55));
    const keyL = new THREE.DirectionalLight(0xffffff, 1.5);
    keyL.position.set(3.5, 7, 5);
    scene.add(keyL);
    const fillL = new THREE.DirectionalLight(0xd8d0ff, 0.65);
    fillL.position.set(-4, 2, 3);
    scene.add(fillL);
    const rimL2 = new THREE.DirectionalLight(0xbae6fd, 0.35);
    rimL2.position.set(0, 4, -5);
    scene.add(rimL2);
    const underL = new THREE.DirectionalLight(0xede9fe, 0.2);
    underL.position.set(0, -3, 3);
    scene.add(underL);

    // ── Materials ──
    const M = (o) => new THREE.MeshStandardMaterial(o);
    const mSuit = M({ color: 0x4f46e5, roughness: 0.52, metalness: 0.1 });
    const mSuitB = M({ color: 0x6366f1, roughness: 0.48, metalness: 0.08 });
    const mDark = M({ color: 0x2e1065, roughness: 0.42, metalness: 0.18 });
    const mFace = M({ color: 0xf5f3ff, roughness: 0.62, metalness: 0 });
    const mBadge = M({ color: 0x818cf8, roughness: 0.3, metalness: 0.2 });
    const mEyeW = M({ color: 0xfcfcfc, roughness: 0.35, metalness: 0 });
    const mEyeI = M({ color: 0x1e1b4b, roughness: 0.2, metalness: 0 });
    const mEyeP = M({ color: 0x060612, roughness: 0.3 });
    const mEyeS = M({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.9,
      roughness: 0,
    });
    const mBlush = M({
      color: 0xfda4af,
      transparent: true,
      opacity: 0.48,
      roughness: 1,
      side: THREE.DoubleSide,
    });
    const mMouth = M({ color: 0x1e1b4b, roughness: 0.4 });
    const mGlow = M({
      color: 0x34d399,
      emissive: 0x34d399,
      emissiveIntensity: 1.0,
      roughness: 0.05,
    });
    const mRing = M({
      color: 0x818cf8,
      emissive: 0x6366f1,
      emissiveIntensity: 0.35,
      roughness: 0.25,
    });
    const mShad = M({
      color: 0x1e1b4b,
      transparent: true,
      opacity: 0.18,
      roughness: 1,
      side: THREE.DoubleSide,
    });

    const robot = new THREE.Group();
    robot.rotation.y = 0.18;
    scene.add(robot);

    // ═══════════════════════════
    // HEAD — large round helmet
    // ═══════════════════════════
    const headGrp = new THREE.Group();
    robot.add(headGrp);

    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.8, 48, 48), mSuit);
    helm.scale.set(1.1, 1.0, 0.97);
    helm.position.y = 1.55;
    headGrp.add(helm);

    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.84, 0.052, 12, 70),
      mSuitB,
    );
    band.scale.set(1.08, 0.9, 0.97);
    band.position.y = 1.56;
    headGrp.add(band);

    const visor = new THREE.Mesh(new THREE.CircleGeometry(0.62, 44), mFace);
    visor.position.set(0, 1.58, 0.77);
    headGrp.add(visor);

    const visorRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.042, 10, 55),
      mDark,
    );
    visorRing.position.set(0, 1.58, 0.75);
    headGrp.add(visorRing);

    // ── Eyes ──
    function makeEye(x) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.CircleGeometry(0.145, 32), mEyeW));
      const iris = new THREE.Mesh(new THREE.CircleGeometry(0.108, 26), mEyeI);
      iris.position.z = 0.002;
      g.add(iris);
      const iRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.108, 0.018, 8, 24),
        mRing,
      );
      iRing.position.z = 0.001;
      g.add(iRing);
      const pup = new THREE.Mesh(new THREE.CircleGeometry(0.065, 22), mEyeP);
      pup.position.z = 0.005;
      g.add(pup);
      const s1 = new THREE.Mesh(new THREE.CircleGeometry(0.03, 14), mEyeS);
      s1.position.set(-0.03, 0.05, 0.01);
      g.add(s1);
      const s2 = new THREE.Mesh(new THREE.CircleGeometry(0.017, 10), mEyeS);
      s2.position.set(0.044, -0.012, 0.01);
      g.add(s2);
      g.position.set(x, 1.63, 0.78);
      return g;
    }
    const eyeL = makeEye(-0.225);
    const eyeR = makeEye(0.225);
    headGrp.add(eyeL, eyeR);

    // ── Blush ──
    const bGeo = new THREE.CircleGeometry(0.1, 22);
    const bL = new THREE.Mesh(bGeo, mBlush);
    bL.position.set(-0.52, 1.48, 0.73);
    bL.rotation.y = 0.4;
    headGrp.add(bL);
    const bR = new THREE.Mesh(bGeo, mBlush);
    bR.position.set(0.52, 1.48, 0.73);
    bR.rotation.y = -0.4;
    headGrp.add(bR);

    // ── Smile ──
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.028, 10, 30, Math.PI * 0.78),
      mMouth,
    );
    smile.rotation.z = Math.PI;
    smile.position.set(0, 1.33, 0.79);
    headGrp.add(smile);

    // ── Ear pads ──
    function makeEar(x) {
      const ep = new THREE.Mesh(new THREE.SphereGeometry(0.26, 22, 18), mSuitB);
      ep.scale.set(0.5, 0.82, 0.62);
      ep.position.set(x, 1.57, 0.06);
      headGrp.add(ep);
      const er = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.025, 8, 22),
        mDark,
      );
      er.rotation.y = Math.PI / 2;
      er.position.set(x + Math.sign(x) * 0.02, 1.57, 0.06);
      headGrp.add(er);
    }
    makeEar(-0.9);
    makeEar(0.9);

    // ── Antenna fin + dot ──
    const antBase = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 16, 14),
      mSuitB,
    );
    antBase.scale.set(0.7, 1.6, 0.55);
    antBase.position.set(0, 2.4, 0.02);
    headGrp.add(antBase);
    const antDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 14, 14),
      mGlow,
    );
    antDot.position.set(0, 2.56, 0.02);
    headGrp.add(antDot);

    // ═══════════════════════════
    // NECK
    // ═══════════════════════════
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.27, 0.24, 18),
      mDark,
    );
    neck.position.y = 0.97;
    robot.add(neck);
    const neckRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.03, 10, 32),
      mSuitB,
    );
    neckRing.position.y = 0.92;
    robot.add(neckRing);

    // ═══════════════════════════
    // BODY — puffy compact
    // ═══════════════════════════
    const bodyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.58, 38, 38),
      mSuit,
    );
    bodyMesh.scale.set(1.2, 0.98, 0.88);
    bodyMesh.position.y = 0.46;
    robot.add(bodyMesh);

    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.13, 6), mBadge);
    badge.position.set(0, 0.58, 0.52);
    robot.add(badge);
    const badgeRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.13, 0.02, 8, 18),
      mDark,
    );
    badgeRing.position.set(0, 0.58, 0.51);
    robot.add(badgeRing);

    const belt = new THREE.Mesh(
      new THREE.TorusGeometry(0.57, 0.045, 10, 44),
      mDark,
    );
    belt.scale.set(1.2, 0.88, 0.88);
    belt.position.y = 0.22;
    robot.add(belt);

    [-0.82, 0.82].forEach((x) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.26, 22, 18), mSuitB);
      s.scale.set(0.88, 0.86, 0.82);
      s.position.set(x, 0.82, 0.04);
      robot.add(s);
    });

    // ═══════════════════════════
    // ARMS
    // ═══════════════════════════
    const lAG = new THREE.Group();
    lAG.position.set(-0.82, 0.75, 0);
    lAG.rotation.z = 0.28;
    robot.add(lAG);
    [
      [-0.24, mSuit, 0.135, 0.12, 0.38],
      [-0.67, mSuit, 0.115, 0.11, 0.32],
    ].forEach(([y, m, r1, r2, h]) => {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 16), m);
      seg.position.y = y;
      lAG.add(seg);
    });
    const lEj = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 14), mSuitB);
    lEj.position.y = -0.47;
    lAG.add(lEj);
    const lH = new THREE.Mesh(new THREE.SphereGeometry(0.175, 20, 16), mSuitB);
    lH.scale.set(1.0, 0.82, 0.92);
    lH.position.y = -0.88;
    lAG.add(lH);

    const rAG = new THREE.Group();
    rAG.position.set(0.82, 0.75, 0);
    robot.add(rAG);
    const rU = new THREE.Mesh(
      new THREE.CylinderGeometry(0.135, 0.12, 0.38, 16),
      mSuit,
    );
    rU.position.y = -0.24;
    rAG.add(rU);
    const rEj = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 14), mSuitB);
    rEj.position.y = -0.47;
    rAG.add(rEj);
    const rFG = new THREE.Group();
    rFG.position.y = -0.47;
    rAG.add(rFG);
    const rF = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.11, 0.32, 16),
      mSuit,
    );
    rF.position.y = -0.2;
    rFG.add(rF);
    const rH = new THREE.Mesh(new THREE.SphereGeometry(0.175, 20, 16), mSuitB);
    rH.scale.set(1.0, 0.82, 0.92);
    rH.position.y = -0.4;
    rFG.add(rH);

    // ═══════════════════════════
    // LEGS — short + puffy
    // ═══════════════════════════
    function makeLeg(x) {
      const g = new THREE.Group();
      g.position.set(x, 0.0, 0);
      robot.add(g);
      const hip = new THREE.Mesh(
        new THREE.SphereGeometry(0.21, 18, 16),
        mSuitB,
      );
      hip.position.y = -0.04;
      g.add(hip);
      const thi = new THREE.Mesh(
        new THREE.CylinderGeometry(0.17, 0.15, 0.32, 16),
        mSuit,
      );
      thi.position.y = -0.25;
      g.add(thi);
      const kn = new THREE.Mesh(new THREE.SphereGeometry(0.165, 14, 14), mDark);
      kn.position.y = -0.46;
      g.add(kn);
      const shi = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.13, 0.28, 16),
        mSuit,
      );
      shi.position.y = -0.64;
      g.add(shi);
      const boot = new THREE.Mesh(
        new THREE.SphereGeometry(0.21, 22, 16),
        mDark,
      );
      boot.scale.set(1.4, 0.62, 1.75);
      boot.position.set(0.03 * Math.sign(x), -0.82, 0.1);
      g.add(boot);
      const sole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.28, 0.06, 20),
        mSuit,
      );
      sole.position.set(0.03 * Math.sign(x), -0.98, 0.1);
      g.add(sole);
    }
    makeLeg(-0.32);
    makeLeg(0.32);

    // Ground shadow disc
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 36), mShad);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, -1.08, 0);
    shadow.scale.z = 0.5;
    robot.add(shadow);

    // ═══════════════════════════
    // MOUSE PARALLAX
    // ═══════════════════════════
    let tRY = 0.18,
      tRX = 0;
    canvas.addEventListener("mousemove", (e) => {
      const rc = canvas.getBoundingClientRect();
      tRY = ((e.clientX - rc.left) / rc.width - 0.5) * 0.52 + 0.18;
      tRX = -((e.clientY - rc.top) / rc.height - 0.5) * 0.26;
    });
    canvas.addEventListener("mouseleave", () => {
      tRY = 0.18;
      tRX = 0;
    });

    // ═══════════════════════════
    // ANIMATION
    // ═══════════════════════════
    let t = 0;
    let blinkTimer = 0,
      isBlinking = false,
      blinkP = 0,
      nextBlink = 2.2 + Math.random() * 2.5;

    function animate() {
      requestAnimationFrame(animate);
      t += 0.016;

      // Float
      robot.position.y = Math.sin(t * 1.2) * 0.052;

      // Gentle head personality sway
      headGrp.rotation.z = Math.sin(t * 0.82) * 0.022;
      headGrp.rotation.x = Math.sin(t * 0.55) * 0.018;

      // Waving arm
      const wp = (t % 4.5) / 4.5;
      if (wp < 0.6) {
        rAG.rotation.z = -1.05 + Math.sin(wp * Math.PI * 4.6) * 0.5;
        rFG.rotation.z = Math.sin(wp * Math.PI * 4.6) * 0.26;
      } else {
        const r = (wp - 0.6) / 0.4;
        rAG.rotation.z = THREE.MathUtils.lerp(-0.05, 0.1, r);
        rFG.rotation.z = 0;
      }

      // Left arm subtle sway
      lAG.rotation.x = Math.sin(t * 1.2) * 0.055;

      // Antenna dot pulse
      const dp = 0.82 + Math.sin(t * 3.6) * 0.18;
      antDot.scale.setScalar(dp);
      antDot.material.emissiveIntensity = 0.6 + Math.sin(t * 3.6) * 0.5;

      // Shadow breathes with float
      const fy = Math.sin(t * 1.2);
      shadow.scale.set(1 - fy * 0.08, 1, 0.5 - fy * 0.04);
      shadow.material.opacity = 0.18 - fy * 0.04;

      // Blink
      blinkTimer += 0.016;
      if (!isBlinking && blinkTimer > nextBlink) {
        isBlinking = true;
        blinkP = 0;
        blinkTimer = 0;
        nextBlink = 1.8 + Math.random() * 3.2;
      }
      if (isBlinking) {
        blinkP += 0.22;
        const b =
          blinkP < Math.PI ? Math.max(0.04, Math.sin(blinkP) * 0.5 + 0.5) : 1;
        eyeL.scale.y = b;
        eyeR.scale.y = b;
        if (blinkP >= Math.PI) {
          isBlinking = false;
          eyeL.scale.y = eyeR.scale.y = 1;
        }
      }

      // Mouse parallax
      robot.rotation.y += (tRY - robot.rotation.y) * 0.062;
      robot.rotation.x += (tRX - robot.rotation.x) * 0.062;

      renderer.render(scene, camera);
    }
    animate();
  } catch (e) {
    console.warn("Robot canvas error (non-fatal):", e.message);
  }
})();

// ─── Auth Modal ───────────────────────────────────────────────────────────────
(function initAuthWidget() {
  const triggerBtn = document.getElementById("authTriggerBtn");
  const userBtn = document.getElementById("authUserBtn");
  const overlay = document.getElementById("authModalOverlay");
  const modalClose = document.getElementById("authModalClose");
  const authForm = document.getElementById("authForm");
  const authError = document.getElementById("authError");
  const authNameField = document.getElementById("authNameField");
  const authName = document.getElementById("authName");
  const authEmail = document.getElementById("authEmail");
  const authPassword = document.getElementById("authPassword");
  const authSubmitBtn = document.getElementById("authSubmitBtn");
  const authFormPanel = document.getElementById("authFormPanel");
  const authUserPanel = document.getElementById("authUserPanel");
  const authLogoutBtn = document.getElementById("authLogoutBtn");
  const authAvatar = document.getElementById("authAvatar");
  const authUserName = document.getElementById("authUserName");
  const authAvatarLg = document.getElementById("authAvatarLg");
  const authFullName = document.getElementById("authFullName");
  const authEmailSm = document.getElementById("authEmailSm");
  const tabs = document.querySelectorAll(".auth-tab");

  // bail out only if the trigger button is missing
  if (!triggerBtn || !authForm) return;

  let mode = "login";

  // ── Token helpers ──
  function getToken() {
    return localStorage.getItem("chatbot_token");
  }
  function setToken(t) {
    localStorage.setItem("chatbot_token", t);
  }
  function clearToken() {
    localStorage.removeItem("chatbot_token");
  }

  // ── Modal open / close ──
  function openModal() {
    if (!overlay) {
      alert("Auth modal not found — please hard-refresh (Ctrl+Shift+R)");
      return;
    }
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    if (authEmail) setTimeout(() => authEmail.focus(), 50);
  }
  function closeModal() {
    if (overlay) overlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  triggerBtn.addEventListener("click", openModal);
  if (userBtn) userBtn.addEventListener("click", openModal);
  if (modalClose) modalClose.addEventListener("click", closeModal);

  // Close when clicking the dark backdrop (not the modal box itself)
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // Close with Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay && overlay.classList.contains("open"))
      closeModal();
  });

  // ── Tabs ──
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      mode = tab.dataset.tab;
      if (authNameField)
        authNameField.style.display = mode === "signup" ? "block" : "none";
      if (authSubmitBtn)
        authSubmitBtn.textContent =
          mode === "signup" ? "Create account" : "Login";
      clearError();
    });
  });

  function showError(msg) {
    if (!authError) return;
    authError.textContent = msg;
    authError.classList.remove("hidden");
  }
  function clearError() {
    authError && authError.classList.add("hidden");
  }

  // ── Show logged-in state ──
  function showUser(user) {
    const initial = (user.name || user.email || "U")[0].toUpperCase();
    if (triggerBtn) triggerBtn.classList.add("hidden");
    if (userBtn) userBtn.classList.remove("hidden");
    if (authAvatar) authAvatar.textContent = initial;
    if (authUserName)
      authUserName.textContent = user.name || user.email.split("@")[0];
    if (authFormPanel) authFormPanel.classList.add("hidden");
    if (authUserPanel) authUserPanel.classList.remove("hidden");
    if (authAvatarLg) authAvatarLg.textContent = initial;
    if (authFullName) authFullName.textContent = user.name || "—";
    if (authEmailSm) authEmailSm.textContent = user.email;
    closeModal();
  }

  function showGuest() {
    if (triggerBtn) triggerBtn.classList.remove("hidden");
    if (userBtn) userBtn.classList.add("hidden");
    if (authFormPanel) authFormPanel.classList.remove("hidden");
    if (authUserPanel) authUserPanel.classList.add("hidden");
    authForm.reset();
  }

  // ── Logout ──
  if (authLogoutBtn) {
    authLogoutBtn.addEventListener("click", () => {
      clearToken();
      showGuest();
      closeModal();
    });
  }

  // ── Submit ──
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();
    if (authSubmitBtn) authSubmitBtn.disabled = true;
    if (authSubmitBtn)
      authSubmitBtn.textContent =
        mode === "signup" ? "Creating…" : "Logging in…";

    const email = authEmail ? authEmail.value.trim() : "";
    const password = authPassword ? authPassword.value : "";
    const name = authName ? authName.value.trim() : "";
    const base = backendUrl || "";

    try {
      const endpoint =
        mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body =
        mode === "signup" ? { name, email, password } : { email, password };
      const res = await fetch(`${base}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || data.message || "Request failed");
      setToken(data.token);
      showUser(data.user);
    } catch (err) {
      showError(err.message);
    } finally {
      if (authSubmitBtn) {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent =
          mode === "signup" ? "Create account" : "Login";
      }
    }
  });

  // ── Auto-restore session on load ──
  const savedToken = getToken();
  if (savedToken) {
    const base = backendUrl || "";
    fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${savedToken}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => showUser(data.user))
      .catch(() => {
        clearToken();
        showGuest();
      });
  }
})();
