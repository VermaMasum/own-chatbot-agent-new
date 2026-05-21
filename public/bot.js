// ─── Config ──────────────────────────────────────────────────────────────────

const botId  = getBotIdFromPath();
const isEmbed = new URL(window.location.href).searchParams.has("embed");

document.body.classList.toggle("embed-mode", isEmbed);

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const bcAvatar    = document.getElementById("bcAvatar");
const bcName      = document.getElementById("bcName");
const bcMeta      = document.getElementById("bcMeta");
const bcType      = document.getElementById("bcType");
const bcTone      = document.getElementById("bcTone");
const bcDesc      = document.getElementById("bcDesc");
const chatWindow  = document.getElementById("botChatWindow");
const chatForm    = document.getElementById("botChatForm");
const chatInput   = document.getElementById("botChatInput");
const sendBtn     = document.getElementById("bcSendBtn");
const bcHint      = document.getElementById("bcHint");

// ─── State ────────────────────────────────────────────────────────────────────

let currentBot   = null;
let conversation = [];
let avatarColor  = "#4f46e5";
let prevRole     = null; // for grouping consecutive messages

// ─── Boot ─────────────────────────────────────────────────────────────────────

if (!botId) {
  renderError("Missing chatbot ID in URL.");
} else {
  loadBot();
}

// ─── Submit handler ───────────────────────────────────────────────────────────

chatForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (!message || !currentBot) return;

  chatInput.value = "";
  sendBtn.disabled = true;

  appendMessage("user", message);
  conversation.push({ role: "user", content: message });

  const typingEl = appendTyping();

  try {
    const data = await callApi("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botId: currentBot.id, message, conversation }),
    });

    typingEl.remove();
    const reply = data?.reply || "I couldn't generate a response right now.";
    appendMessage("bot", reply);
    conversation.push({ role: "assistant", content: reply });
  } catch {
    typingEl.remove();
    const fallback = "The chatbot is temporarily unavailable. Please try again.";
    appendMessage("bot", fallback);
    conversation.push({ role: "assistant", content: fallback });
  } finally {
    sendBtn.disabled = false;
    chatInput.focus();
  }
});

// ─── Load bot ─────────────────────────────────────────────────────────────────

async function loadBot() {
  try {
    const bot = await callApi(`/api/bots/${encodeURIComponent(botId)}`);
    if (!bot) { renderError("This chatbot could not be found."); return; }

    currentBot = bot;
    const profile = bot.profile || {};
    const name = profile.projectName || "AI Assistant";

    // Avatar color
    avatarColor = pickColor(name);

    // Header
    bcAvatar.textContent = name[0].toUpperCase();
    bcAvatar.style.background = avatarColor;
    bcName.textContent = name;
    bcMeta.textContent = `${profile.businessType || "General Business"} · ${profile.tone || "Helpful"}`;

    // Info strip
    bcType.innerHTML = `
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
      ${escHtml(profile.businessType || "General")}`;
    bcTone.innerHTML = `
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      ${escHtml(profile.tone || "Helpful")}`;
    bcDesc.textContent = profile.websiteSummary
      || `Ask me anything about ${profile.projectName || "this business"}.`;

    // Page title
    document.title = `Chat with ${name} — BotForge`;

    // Render welcome message
    renderWelcome(bot);
  } catch (err) {
    renderError(err.message || "Could not load chatbot.");
  }
}

// ─── Welcome ─────────────────────────────────────────────────────────────────

function renderWelcome(bot) {
  chatWindow.innerHTML = "";
  prevRole = null;

  // Date separator
  const sep = document.createElement("div");
  sep.className = "bc-date-label";
  sep.textContent = "Today";
  chatWindow.appendChild(sep);

  const name = bot.profile?.projectName || "your chatbot";
  const greeting = bot.profile?.greeting
    || `Hi! I'm ${name}. How can I help you today?`;
  appendMessage("bot", greeting);

  // Quick reply chips if available
  const quickReplies = bot.profile?.quickReplies || [];
  if (quickReplies.length) {
    const chipsWrap = document.createElement("div");
    chipsWrap.className = "bc-quick-chips";
    quickReplies.slice(0, 4).forEach(text => {
      const btn = document.createElement("button");
      btn.className = "bc-chip";
      btn.textContent = text;
      btn.addEventListener("click", () => {
        chatInput.value = text;
        chatForm.dispatchEvent(new Event("submit"));
      });
      chipsWrap.appendChild(btn);
    });
    chatWindow.appendChild(chipsWrap);
  }
}

// ─── Message rendering ────────────────────────────────────────────────────────

function appendMessage(role, text) {
  const isBot  = role === "bot";
  const isUser = role === "user";

  const row = document.createElement("div");
  row.className = `bc-msg msg-${role}`;

  if (isBot) {
    // Show avatar only on first of consecutive bot messages
    const av = document.createElement("div");
    av.className = `bc-msg-av ${prevRole === "bot" ? "hidden-av" : ""}`;
    av.style.background = avatarColor;
    av.textContent = (currentBot?.profile?.projectName || "A")[0].toUpperCase();
    row.appendChild(av);
  }

  const bubble = document.createElement("div");
  bubble.className = "bc-bubble";
  bubble.textContent = text;
  row.appendChild(bubble);

  // Timestamp
  if (isUser || isBot) {
    const ts = document.createElement("div");
    ts.style.cssText = "font-size:.62rem;color:var(--text-subtle);margin-top:3px;padding:0 4px;align-self:flex-end;flex-shrink:0;";
    ts.textContent = now();
    row.appendChild(ts);
  }

  chatWindow.appendChild(row);
  scrollToBottom();
  prevRole = role;
  return row;
}

function appendTyping() {
  const row = document.createElement("div");
  row.className = "bc-msg msg-bot";

  const av = document.createElement("div");
  av.className = `bc-msg-av ${prevRole === "bot" ? "hidden-av" : ""}`;
  av.style.background = avatarColor;
  av.textContent = (currentBot?.profile?.projectName || "A")[0].toUpperCase();
  row.appendChild(av);

  const bubble = document.createElement("div");
  bubble.className = "bc-bubble";

  const dots = document.createElement("div");
  dots.className = "bc-typing";
  dots.innerHTML = "<span></span><span></span><span></span>";
  bubble.appendChild(dots);
  row.appendChild(bubble);

  chatWindow.appendChild(row);
  scrollToBottom();
  return row;
}

function renderError(message) {
  bcName.textContent = "Chatbot unavailable";
  bcMeta.textContent = message;
  bcDesc.textContent = message;
  chatWindow.innerHTML = "";
  prevRole = null;

  const row = document.createElement("div");
  row.className = "bc-msg msg-system";
  const bubble = document.createElement("div");
  bubble.className = "bc-bubble";
  bubble.textContent = "⚠️ " + message;
  row.appendChild(bubble);
  chatWindow.appendChild(row);

  if (chatInput)  chatInput.disabled = true;
  if (sendBtn)    sendBtn.disabled   = true;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function scrollToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getBotIdFromPath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[0] === "bot" && parts[1] ? parts[1] : "";
}

async function callApi(path, options) {
  const res  = await fetch(path, options);
  const data = await res.json();
  if (!res.ok || data?.error) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function pickColor(name) {
  const palette = [
    "#4f46e5", "#7c3aed", "#db2777", "#ea580c",
    "#16a34a", "#0891b2", "#2563eb", "#9333ea",
  ];
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return palette[Math.abs(hash) % palette.length];
}
