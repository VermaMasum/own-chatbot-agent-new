// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  color: "#4f46e5",
  position: "bottom-right",
  label: "Chat with us",
  greeting: "",
  botId: null,
  botName: "Chatbot",
  embedUrl: "",
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const cfgColor     = document.getElementById("cfgColor");
const cfgColorHex  = document.getElementById("cfgColorHex");
const cfgLabel     = document.getElementById("cfgLabel");
const cfgGreeting  = document.getElementById("cfgGreeting");
const snippetOutput = document.getElementById("snippetOutput");
const copyBtn      = document.getElementById("copyBtn");
const botInfo      = document.getElementById("botInfo");
const botInfoName  = document.getElementById("botInfoName");
const botInfoId    = document.getElementById("botInfoId");
const previewBtn   = document.getElementById("preview-widget-btn");
const previewBtnLabel = document.getElementById("preview-btn-label");
const previewChatBox  = document.getElementById("preview-chat-box");
const previewHeader   = document.getElementById("preview-chat-header");
const previewAvatar   = document.getElementById("preview-avatar");
const previewBotName  = document.getElementById("preview-bot-name");
const previewSendBtn  = document.getElementById("preview-send-btn");
const previewGreetBubble = document.getElementById("preview-greeting-bubble");
const previewUserBubble  = document.getElementById("preview-user-bubble");

// ─── Init ─────────────────────────────────────────────────────────────────────

const pathParts = window.location.pathname.split("/").filter(Boolean);
// /embed-builder/:botId
if (pathParts[0] === "embed-builder" && pathParts[1]) {
  state.botId = pathParts[1];
  loadBot(state.botId);
} else {
  // No bot id — still usable as a generic preview
  render();
}

// ─── Load bot ─────────────────────────────────────────────────────────────────

async function loadBot(botId) {
  try {
    const res  = await fetch(`/api/bots/${encodeURIComponent(botId)}`);
    const data = await res.json();
    if (!res.ok || data?.error) throw new Error(data?.error || "Bot not found");

    state.botId    = data.id;
    state.botName  = data.profile?.projectName || "Chatbot";
    state.embedUrl = data.embedUrl || "";

    botInfoName.textContent = state.botName;
    botInfoId.textContent   = `ID: ${state.botId}`;
    botInfo.style.display   = "flex";

    previewBotName.textContent = state.botName;
    previewAvatar.textContent  = (state.botName[0] || "C").toUpperCase();

    render();
  } catch (err) {
    botInfoName.textContent = "Bot not found";
    botInfo.style.display   = "flex";
    render();
  }
}

// ─── Render (update everything from state) ────────────────────────────────────

function render() {
  const { color, position, label, greeting, botId, embedUrl } = state;

  // Preview widget button
  previewBtn.style.background = color;
  previewBtnLabel.textContent = label || "Chat";

  // Preview position
  const isLeft = position === "bottom-left" || position === "top-left";
  const isTop  = position === "top-right"   || position === "top-left";
  previewBtn.style.left   = isLeft ? "16px" : "";
  previewBtn.style.right  = isLeft ? "" : "16px";
  previewBtn.style.bottom = isTop  ? "" : "16px";
  previewBtn.style.top    = isTop  ? "16px" : "";

  // Chat box position
  previewChatBox.style.left   = isLeft ? "16px" : "";
  previewChatBox.style.right  = isLeft ? "" : "16px";
  previewChatBox.style.bottom = isTop  ? "" : "72px";
  previewChatBox.style.top    = isTop  ? "72px" : "";
  previewChatBox.style.transformOrigin = (isLeft ? "left" : "right") + " " + (isTop ? "top" : "bottom");

  // Chat box header color
  previewHeader.style.background = color;
  previewSendBtn.style.background = color;
  previewUserBubble.style.background = color;

  // Greeting bubble
  if (greeting) {
    previewGreetBubble.textContent = greeting;
  } else {
    previewGreetBubble.textContent = `Hi! I'm ${state.botName}. How can I help?`;
  }

  // Generated snippet
  const src = embedUrl || (state.botId ? `[YOUR_SERVER]/embed/${state.botId}.js` : `[YOUR_SERVER]/embed/[BOT_ID].js`);
  const attrs = [
    `src="${src}"`,
    state.botId ? `data-bot-id="${state.botId}"` : null,
    `data-color="${color}"`,
    `data-position="${position}"`,
    `data-label="${escapeAttr(label)}"`,
    greeting ? `data-greeting="${escapeAttr(greeting)}"` : null,
    "async",
  ].filter(Boolean).join("\n  ");

  snippetOutput.value = `<script\n  ${attrs}\n><\/script>`;

  // Pos buttons active state
  document.querySelectorAll(".pos-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.pos === position);
  });
}

// ─── Controls ─────────────────────────────────────────────────────────────────

cfgColor.addEventListener("input", () => {
  state.color = cfgColor.value;
  cfgColorHex.value = cfgColor.value;
  render();
});

cfgColorHex.addEventListener("input", () => {
  const v = cfgColorHex.value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
    state.color = v;
    cfgColor.value = v;
    render();
  }
});

cfgColorHex.addEventListener("blur", () => {
  if (!/^#[0-9a-fA-F]{6}$/.test(cfgColorHex.value)) {
    cfgColorHex.value = state.color;
  }
});

cfgLabel.addEventListener("input", () => {
  state.label = cfgLabel.value;
  render();
});

cfgGreeting.addEventListener("input", () => {
  state.greeting = cfgGreeting.value;
  render();
});

document.querySelectorAll(".pos-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.position = btn.dataset.pos;
    // Close preview chat when changing position
    previewChatBox.classList.remove("open");
    render();
  });
});

// ─── Copy button ──────────────────────────────────────────────────────────────

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(snippetOutput.value);
    copyBtn.textContent = "Copied!";
    copyBtn.classList.add("copied");
    setTimeout(() => {
      copyBtn.textContent = "Copy code";
      copyBtn.classList.remove("copied");
    }, 2000);
  } catch {
    snippetOutput.select();
    document.execCommand("copy");
  }
});

// ─── Preview chat toggle (called from inline onclick in HTML) ─────────────────

window.togglePreviewChat = function () {
  previewChatBox.classList.toggle("open");
};

// ─── Utils ────────────────────────────────────────────────────────────────────

function escapeAttr(str) {
  return String(str || "").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
