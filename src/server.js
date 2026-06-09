import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { buildChatbotProfile } from "./builder.js";
import {
  getBot as dbGetBot,
  listBots as dbListBots,
  saveBot as dbSaveBot,
  saveChatExchange,
  saveCrawlRun,
  createUser as dbCreateUser,
  findUserByEmail as dbFindUserByEmail,
  findUserById as dbFindUserById,
} from "./db.js";

const scryptAsync = promisify(scrypt);
import { listTemplates } from "./templates.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");
const rootDir = resolve(__dirname, "..");
const publicDir = resolve(rootDir, "public");

await loadEnvFile(resolve(rootDir, ".env"));

// AI provider config — swap by setting env vars, no code change needed
// Groq (free/dev):   AI_BASE_URL=https://api.groq.com/openai/v1  AI_MODEL=llama-3.1-8b-instant  AI_API_KEY=...
// OpenAI (prod):     AI_BASE_URL=https://api.openai.com/v1        AI_MODEL=gpt-4o-mini            AI_API_KEY=sk-...
// OpenRouter (prod): AI_BASE_URL=https://openrouter.ai/api/v1     AI_MODEL=openai/gpt-4o-mini     AI_API_KEY=...
const aiBaseUrl = process.env.AI_BASE_URL || process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
const aiModel   = process.env.AI_MODEL    || process.env.GROQ_MODEL    || "llama-3.1-8b-instant";
const aiApiKey  = process.env.AI_API_KEY  || process.env.GROQ_API_KEY  || "";
const websiteContextCache = new Map();

const port = Number(process.env.PORT || 3000);

export async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,content-type,authorization",
  );
  res.setHeader("Access-Control-Allow-Credentials", true);

  // Handle Options preflight
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    if (req.method === "GET" && url.pathname === "/api/templates") {
      return sendJson(res, 200, { templates: listTemplates() });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/signup") {
      const body = await readJsonBody(req);
      const { name, email, password } = body || {};
      if (!email || !password) return sendJson(res, 400, { error: "Email and password are required" });
      if (String(password).length < 6) return sendJson(res, 400, { error: "Password must be at least 6 characters" });
      const passwordHash = await hashPassword(String(password));
      let user;
      try {
        user = await dbCreateUser({ name: String(name || "").trim(), email: String(email).trim(), passwordHash });
      } catch (err) {
        return sendJson(res, 409, { error: err.message });
      }
      const token = signToken({ userId: user.id });
      return sendJson(res, 201, { user: safeUser(user), token });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      const body = await readJsonBody(req);
      const { email, password } = body || {};
      if (!email || !password) return sendJson(res, 400, { error: "Email and password are required" });
      const user = await dbFindUserByEmail(String(email).trim());
      if (!user) return sendJson(res, 401, { error: "Invalid email or password" });
      const match = await verifyPassword(String(password), user.passwordHash);
      if (!match) return sendJson(res, 401, { error: "Invalid email or password" });
      const token = signToken({ userId: user.id });
      return sendJson(res, 200, { user: safeUser(user), token });
    }

    if (req.method === "GET" && url.pathname === "/api/auth/me") {
      const user = await requireAuth(req);
      if (!user) return sendJson(res, 401, { error: "Unauthorized" });
      return sendJson(res, 200, { user: safeUser(user) });
    }

    if (req.method === "POST" && url.pathname === "/api/build") {
      const body = await readJsonBody(req);
      const empty = { title: "", summary: "", pages: [], sections: [], chunks: [], topics: [] };
      const puppeteerDisabled = process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD === "true";

      let websiteContext = null;

      // Step 1: Puppeteer — primary scraper (full JS rendering)
      if (!puppeteerDisabled && body.websiteUrl) {
        console.log(`[scrape] Trying puppeteer for: ${body.websiteUrl}`);
        const deadline = new Promise((resolve) => setTimeout(() => resolve(null), 35000));
        websiteContext = await Promise.race([getWebsiteContext(body.websiteUrl, body.forceRefresh), deadline]);
        console.log(`[scrape] Puppeteer — title: "${websiteContext?.title}", chunks: ${websiteContext?.chunks?.length ?? 0}, summary len: ${(websiteContext?.summary || "").length}`);
      }

      // Step 2: Jina — fallback only when puppeteer returns nothing at all
      if (body.websiteUrl && (!websiteContext || (!websiteContext.title && !websiteContext.summary && !(websiteContext.chunks?.length)))) {
        console.log(`[scrape] Puppeteer returned nothing — trying Jina: ${body.websiteUrl}`);
        websiteContext = await Promise.race([
          getSimpleWebsiteContext(body.websiteUrl),
          new Promise((r) => setTimeout(() => r(null), 28000))
        ]);
        console.log(`[scrape] Jina — title: "${websiteContext?.title}", chunks: ${websiteContext?.chunks?.length ?? 0}`);
      }

      if (!websiteContext || (!websiteContext.title && !websiteContext.summary && !(websiteContext.chunks?.length))) {
        console.log(`[scrape] All scrapers failed — using form inputs only`);
        websiteContext = empty;
      }
      await saveCrawlRun({
        websiteUrl: body.websiteUrl || "",
        title: websiteContext.title || "",
        summary: websiteContext.summary || "",
        pages: websiteContext.pages || [],
        sections: websiteContext.sections || [],
        chunks: websiteContext.chunks || [],
        topics: websiteContext.topics || [],
        source: isValidWebsiteContext(websiteContext) ? "crawl" : "fallback",
      });
      const profile = buildChatbotProfile({
        ...body,
        websiteTitle: websiteContext.title,
        websiteSummary: websiteContext.summary,
        websitePages: websiteContext.pages,
        websiteSections: websiteContext.sections,
        websiteChunks: websiteContext.chunks,
        websiteTopics: websiteContext.topics,
      });
      return sendJson(res, 200, profile);
    }

    if (req.method === "POST" && url.pathname === "/api/publish") {
      const body = await readJsonBody(req);
      const profile =
        body?.profile && typeof body.profile === "object" ? body.profile : body;
      const savedBot = await saveBot(profile, body?.botId || body?.id);
      return sendJson(res, 200, formatBotResponse(savedBot, req));
    }

    if (req.method === "GET" && url.pathname === "/api/bots") {
      const bots = await listBots();
      return sendJson(res, 200, {
        bots: bots.map((bot) => formatBotSummary(bot, req)),
      });
    }

    const botRouteMatch = url.pathname.match(/^\/api\/bots\/([^/]+)$/);
    if (req.method === "GET" && botRouteMatch) {
      const bot = await getBot(botRouteMatch[1]);
      if (!bot) {
        return sendJson(res, 404, { error: "Bot not found" });
      }
      return sendJson(res, 200, formatBotResponse(bot, req));
    }

    const embedRouteMatch = url.pathname.match(/^\/embed\/([^/]+)\.js$/);
    if (req.method === "GET" && embedRouteMatch) {
      const bot = await getBot(embedRouteMatch[1]);
      if (!bot) {
        return sendText(res, 404, "Bot not found");
      }
      return sendEmbedScript(res, bot, req);
    }

    if (req.method === "GET" && /^\/bot\/[^/]+$/.test(url.pathname)) {
      return serveBotPage(res);
    }

    const embedBuilderMatch = url.pathname.match(/^\/embed-builder\/([^/]+)$/);
    if (req.method === "GET" && embedBuilderMatch) {
      return serveEmbedBuilderPage(res);
    }

    if (req.method === "GET" && url.pathname === "/widget-builder") {
      return serveWidgetBuilderPage(res);
    }

    if (req.method === "POST" && url.pathname === "/api/chat") {
      const body = await readJsonBody(req);
      const reply = await generateChatReply(body);
      await saveChatExchange({
        botId: String(body.botId || body?.profile?.botId || "").trim(),
        sessionId: String(body.sessionId || body.conversationId || "").trim(),
        userMessage: body.message || "",
        assistantReply: reply.reply || "",
        provider: reply.provider || "fallback",
      });
      return sendJson(res, 200, reply);
    }

    return serveStatic(url.pathname, res);
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Server error" });
  }
}

if (!process.env.VERCEL) {
  const server = http.createServer(handler);
  server.listen(port, () => {
    console.log(`Own Chatbot Agent UI running at http://localhost:${port}`);
  });
}

async function serveStatic(pathname, res) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(publicDir, `.${safePath}`);

  if (!filePath.startsWith(publicDir)) {
    return sendText(res, 403, "Forbidden");
  }

  try {
    const data = await readFile(filePath);
    return sendFile(res, 200, data, extname(filePath));
  } catch {
    if (safePath !== "/index.html") {
      try {
        const fallback = await readFile(join(publicDir, "index.html"));
        return sendFile(res, 200, fallback, ".html");
      } catch {
        return sendText(res, 404, "Not found");
      }
    }
    return sendText(res, 404, "Not found");
  }
}

function sendFile(res, status, data, ext) {
  const type =
    {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
    }[ext] || "application/octet-stream";

  const headers = { "Content-Type": type };
  // Never cache HTML so the browser always gets the latest version
  if (ext === ".html") {
    headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
    headers["Pragma"] = "no-cache";
    headers["Expires"] = "0";
  }
  res.writeHead(status, headers);
  res.end(data);
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

async function saveBot(profile, botId) {
  return dbSaveBot(profile, botId);
}

async function listBots() {
  return dbListBots();
}

async function getBot(botId) {
  return dbGetBot(botId);
}

function formatBotSummary(bot, req) {
  const urls = buildBotUrls(bot.id, req);
  return {
    id: bot.id,
    projectName: bot.profile?.projectName || "Untitled chatbot",
    businessType: bot.profile?.businessType || "General Business",
    createdAt: bot.createdAt,
    updatedAt: bot.updatedAt,
    publicUrl: urls.publicUrl,
    embedUrl: urls.embedUrl,
  };
}

function formatBotResponse(bot, req) {
  const urls = buildBotUrls(bot.id, req);
  return {
    ...bot,
    ...urls,
    embedScript: `<script src="${urls.embedUrl}" data-bot-id="${bot.id}" async></script>`,
    embedIframe: `<iframe src="${urls.publicUrl}?embed=1" title="${escapeAttribute(bot.profile?.projectName || "Chatbot")}" style="border:0;width:100%;max-width:420px;height:620px;border-radius:24px;overflow:hidden;"></iframe>`,
    embedBuilderUrl: urls.embedBuilderUrl,
  };
}

function buildBotUrls(botId, req) {
  const host = req.headers.host || `localhost:${port}`;
  const protocol =
    String(req.headers["x-forwarded-proto"] || "http")
      .split(",")[0]
      .trim() || "http";
  const origin = `${protocol}://${host}`;
  return {
    publicUrl: `${origin}/bot/${botId}`,
    embedUrl: `${origin}/embed/${botId}.js`,
    embedBuilderUrl: `${origin}/embed-builder/${botId}`,
  };
}

function sendEmbedScript(res, bot, req) {
  const urls = buildBotUrls(bot.id, req);
  const botName = bot.profile?.projectName || "Chatbot";
  const script = `
(function () {
  var s = document.currentScript;
  var color    = (s && s.dataset.color)    || '#4f46e5';
  var position = (s && s.dataset.position) || 'bottom-right';
  var label    = (s && s.dataset.label)    || 'Chat';
  var greeting = (s && s.dataset.greeting) || '';
  var chatUrl  = ${JSON.stringify(urls.publicUrl + "?embed=1")};
  var botName  = ${JSON.stringify(botName)};

  var isLeft = position === 'bottom-left';
  var isTop  = position === 'top-right' || position === 'top-left';
  var hEdge  = isLeft ? 'left:20px' : 'right:20px';
  var vEdge  = isTop  ? 'top:20px'  : 'bottom:20px';
  var vBox   = isTop  ? 'top:80px'  : 'bottom:80px';
  var origin = (isLeft ? 'left' : 'right') + ' ' + (isTop ? 'top' : 'bottom');

  var css = document.createElement('style');
  css.textContent =
    '#cb-btn{position:fixed;' + hEdge + ';' + vEdge + ';z-index:2147483646;display:flex;align-items:center;gap:8px;' +
    'padding:0 20px;height:52px;border:none;border-radius:26px;background:' + color + ';color:#fff;' +
    'font:600 14px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 24px rgba(0,0,0,.28);' +
    'transition:transform .2s,box-shadow .2s;}' +
    '#cb-btn:hover{transform:scale(1.06);box-shadow:0 6px 28px rgba(0,0,0,.35);}' +
    '#cb-box{position:fixed;' + hEdge + ';' + vBox + ';width:380px;height:580px;border-radius:18px;overflow:hidden;' +
    'box-shadow:0 8px 48px rgba(0,0,0,.3);z-index:2147483645;' +
    'transform:scale(0.85) translateY(' + (isTop ? '-16px' : '16px') + ');transform-origin:' + origin + ';' +
    'transition:transform .25s cubic-bezier(.34,1.56,.64,1),opacity .2s;opacity:0;pointer-events:none;}' +
    '#cb-box.cb-open{transform:scale(1) translateY(0);opacity:1;pointer-events:auto;}' +
    '#cb-box iframe{width:100%;height:100%;border:0;}' +
    '#cb-close{position:absolute;top:10px;' + (isLeft ? 'right:10px' : 'right:10px') + ';' +
    'background:rgba(0,0,0,.18);border:none;color:#fff;width:28px;height:28px;border-radius:50%;' +
    'cursor:pointer;font-size:17px;line-height:28px;text-align:center;z-index:1;transition:background .15s;}' +
    '#cb-close:hover{background:rgba(0,0,0,.36);}' +
    '@media(max-width:440px){#cb-box{width:calc(100vw - 16px);left:8px;right:8px;' + vBox + ';}}';
  document.head.appendChild(css);

  var icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

  var btn = document.createElement('button');
  btn.id = 'cb-btn';
  btn.innerHTML = icon + '<span>' + label + '</span>';
  btn.setAttribute('aria-label', 'Open ' + botName + ' chat');
  btn.setAttribute('aria-expanded', 'false');

  var box = document.createElement('div');
  box.id = 'cb-box';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', botName + ' chat window');

  var closeBtn = document.createElement('button');
  closeBtn.id = 'cb-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.setAttribute('aria-label', 'Close chat');

  var iframe = document.createElement('iframe');
  iframe.src = chatUrl;
  iframe.title = botName;
  iframe.setAttribute('loading', 'lazy');

  box.appendChild(closeBtn);
  box.appendChild(iframe);

  var opened = false;
  function open() {
    opened = true;
    box.classList.add('cb-open');
    btn.setAttribute('aria-expanded', 'true');
    if (greeting) {
      try { iframe.contentWindow.postMessage({ type: 'cb-greeting', text: greeting }, '*'); } catch(e) {}
    }
  }
  function close() {
    opened = false;
    box.classList.remove('cb-open');
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', function () { opened ? close() : open(); });
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && opened) close(); });

  document.body.appendChild(btn);
  document.body.appendChild(box);
})();
`.trim();

  res.writeHead(200, {
    "Content-Type": "application/javascript; charset=utf-8",
  });
  res.end(script);
}

async function serveBotPage(res) {
  try {
    const data = await readFile(resolve(publicDir, "bot.html"));
    return sendFile(res, 200, data, ".html");
  } catch {
    return sendText(res, 500, "Bot page is unavailable");
  }
}

async function serveEmbedBuilderPage(res) {
  try {
    const data = await readFile(resolve(publicDir, "embed-builder.html"));
    return sendFile(res, 200, data, ".html");
  } catch {
    return sendText(res, 500, "Embed builder page is unavailable");
  }
}

async function serveWidgetBuilderPage(res) {
  try {
    const data = await readFile(resolve(publicDir, "widget-builder.html"));
    return sendFile(res, 200, data, ".html");
  } catch {
    return sendText(res, 500, "Widget builder page is unavailable");
  }
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || "chatbot-agent-secret-change-in-production";
const TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

function signToken(payload) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body   = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS }));
  const sig    = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  try {
    const [header, body, sig] = String(token || "").split(".");
    if (!header || !body || !sig) return null;
    const expected = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expected, "base64url");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function requireAuth(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload?.userId) return null;
  return dbFindUserById(payload.userId);
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)).toString("hex");
  return `${salt}:${hash}`;
}

async function verifyPassword(password, stored) {
  try {
    const [salt, hash] = stored.split(":");
    const incoming = (await scryptAsync(password, salt, 64)).toString("hex");
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(incoming, "hex"));
  } catch {
    return false;
  }
}

function safeUser(user) {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

function b64url(str) {
  return Buffer.from(str).toString("base64url");
}

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function loadEnvFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // No local .env file yet.
  }
}

async function generateChatReply(body) {
  const botId = String(body.botId || "").trim();
  let profile = body.profile || {};
  if (botId) {
    const storedBot = await getBot(botId);
    if (storedBot?.profile) {
      profile = storedBot.profile;
    }
  }
  const userMessage = String(body.message || "").trim();
  const history = Array.isArray(body.conversation) ? body.conversation : [];

  // Filter out garbage chunks (text === "section", text === title, or text too short)
  const allChunks = (Array.isArray(profile.websiteChunks) ? profile.websiteChunks : []).filter(c => {
    const text  = (c.text  || "").trim();
    const title = (c.title || "").trim();
    return text.length > 20 && text.toLowerCase() !== "section" && text.toLowerCase() !== title.toLowerCase();
  });

  const allSections = (Array.isArray(profile.websiteSections) ? profile.websiteSections : []).filter(s => {
    // Puppeteer stores real data in role/company/description even when text = "section"
    const hasStructured = (s.role || "").trim().length > 2 || (s.company || "").trim().length > 2 || (s.description || "").trim().length > 10;
    const text  = (s.text  || "").trim();
    const title = (s.title || "").trim();
    const hasText = text.length > 20 && text.toLowerCase() !== title.toLowerCase();
    // Skip only if no structured fields AND text is garbage
    if (!hasStructured && !hasText) return false;
    return true;
  });

  const relevantChunks   = selectRelevantChunks(allChunks, userMessage);
  const relevantSections = selectRelevantSections(allSections, userMessage);

  const directAnswer =
    inferDirectAnswerFromSections(relevantSections.length ? relevantSections : allSections, userMessage) ||
    inferDirectAnswerFromChunks(relevantChunks.length   ? relevantChunks   : allChunks,    userMessage);

  // Limit context sent to AI — use relevant first, fallback to all, enough for full page coverage
  const contextSections = (relevantSections.length ? relevantSections : allSections).slice(0, 12);
  const contextChunks   = (relevantChunks.length   ? relevantChunks   : allChunks).slice(0, 15);
  const websiteContext  = formatWebsiteContext(contextSections, contextChunks);

  if (!userMessage) {
    return { reply: "Please type a message first." };
  }

  if (!aiApiKey) {
    if (directAnswer) {
      return { reply: directAnswer, provider: "retrieval" };
    }
    return { reply: fallbackReply(userMessage, profile, relevantChunks) };
  }

  try {
    const messages = [
      {
        role: "system",
        content: buildChatSystemPrompt(profile, websiteContext),
      },
      ...history
        .filter(
          (item) =>
            item &&
            typeof item.role === "string" &&
            typeof item.content === "string",
        )
        .slice(-10)
        .map((item) => ({
          role: item.role,
          content: item.content,
        })),
      {
        role: "user",
        content: userMessage,
      },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${aiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiApiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: aiModel,
        messages,
        temperature: 0.55,
        max_tokens: 600,
      }),
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      const bestReply = directAnswer || fallbackReply(userMessage, profile, relevantChunks);
      return { reply: bestReply, error: `Groq request failed with status ${response.status}`, provider: "fallback" };
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      const bestReply = directAnswer || fallbackReply(userMessage, profile, relevantChunks);
      return { reply: bestReply, error: "Groq returned an empty response", provider: "fallback" };
    }

    return { reply, provider: "groq" };
  } catch (error) {
    const bestReply = directAnswer || fallbackReply(userMessage, profile, relevantChunks);
    return { reply: bestReply, error: error?.message || "Groq request failed", provider: "fallback" };
  }
}

function buildChatSystemPrompt(profile, websiteContext = "") {
  const projectName    = profile.projectName    || "this assistant";
  const rawTone        = profile.tone           || "friendly and professional";
  const websiteTitle   = profile.websiteTitle   || "";
  const businessType   = profile.businessType   || "";
  const websiteUrl     = profile.websiteUrl     || "";
  const websiteSummary = (profile.websiteSummary || "").slice(0, 2500);
  const goals           = Array.isArray(profile.goals) ? profile.goals.filter(Boolean) : [];
  const targetAudience  = profile.targetAudience  || "";
  const manualKnowledge = (profile.manualKnowledge || "").trim();

  // Tone → natural personality description
  const toneMap = {
    "friendly":     "warm, approachable, and conversational — like a helpful friend who knows everything about this person/business",
    "professional": "polished and professional — clear, confident, and to the point without being cold",
    "formal":       "formal and structured — precise language, organised answers",
    "casual":       "relaxed and casual — like chatting with someone who really knows their stuff",
    "witty":        "smart and a little witty — engaging, clever but never at the expense of accuracy",
  };
  const toneDesc = toneMap[rawTone.toLowerCase()] || rawTone;

  // Clean knowledgeSources — strip garbage, 404 content, noise, and duplicates
  const knowledgeLines = (Array.isArray(profile.knowledgeSources) ? profile.knowledgeSources : [])
    .map(s => (typeof s === "string" ? s.trim() : ""))
    .filter(s => {
      if (s.length < 20) return false;
      // Skip manualKnowledge — it is already injected directly as "## Provided Information"
      if (/^Manual knowledge:/i.test(s)) return false;
      // garbage: "Chunk: title - section" or "Section: title - section"
      if (/^(Chunk|Section):.+\s-\s+section\s*$/i.test(s)) return false;
      // garbage: "Chunk: title -" (empty text)
      if (/^Chunk:\s*.+\s*-\s*$/.test(s)) return false;
      // noise: bare "Website summary: just-a-slug:" lines
      if (/^Website summary:\s*[\w-]+:\s*$/.test(s)) return false;
      // noise: generic business knowledge hints (not real scraped data)
      if (/^Business knowledge:/.test(s)) return false;
      // skip chunks/pages that are just a navigation list (very short real content)
      if (/^(Chunk|Page):.+\s-\s*(Home|Experience|Projects|Skills|Education|Certifications|Contact)[\s\n]/.test(s) && s.length < 120) return false;
      // 404 content — never tell the AI a page "returned 404" or "could not be found"
      const sl = s.toLowerCase();
      if (sl.includes("404") || sl.includes("not found") || sl.includes("could not be found") || sl.includes("page doesn't exist")) return false;
      return true;
    })
    .slice(0, 30);

  // Build website context block — manual knowledge goes first (highest priority)
  const websiteParts = [
    manualKnowledge       ? `## Provided Information\n${manualKnowledge}` : "",
    websiteSummary        ? `## Website Overview\n${websiteSummary}` : "",
    knowledgeLines.length ? `## Details\n${knowledgeLines.join("\n")}` : "",
    websiteContext        ? `## Page Content\n${websiteContext}` : "",
  ].filter(Boolean);

  const hasWebsiteData = websiteParts.length > 0;

  // Build form-based context block (used when no website data, or to supplement it)
  const formParts = [
    businessType   ? `Type: ${businessType}` : "",
    goals.length   ? `What ${projectName} does: ${goals.join(", ")}` : "",
    targetAudience ? `Audience: ${targetAudience}` : "",
    websiteUrl     ? `Website: ${websiteUrl}` : "",
  ].filter(Boolean);

  const entityLabel = businessType ? `${projectName} (${businessType})` : projectName;

  let contextBlock = "";
  if (hasWebsiteData) {
    contextBlock = `Here is everything you know about ${projectName}:\n\n${websiteParts.join("\n\n")}`;
    if (formParts.length) {
      contextBlock += `\n\n## Basic Info\n${formParts.join("\n")}`;
    }
  } else if (formParts.length) {
    // No website scraped — use form data so the bot still gives sensible answers
    contextBlock = `Here is what you know about ${projectName}:\n\n${formParts.join("\n")}`;
  }

  return `You are the AI assistant for ${entityLabel}${websiteTitle ? ` — ${websiteTitle}` : ""}. Your personality is ${toneDesc}.

${contextBlock || `You are the assistant for ${projectName}. Answer as helpfully as you can with what you know.`}

HOW TO RESPOND:
- The "## Provided Information" section above is your primary source of truth — always read it first and answer directly from it
- Talk like a knowledgeable human — natural, flowing answers, not like you're reading from a list
- For experience/role questions: describe the role and what was done in 1-3 sentences
- For skills questions: give a clear, readable answer — short list or grouped sentence
- For project questions: say what was built, the tech used, and why it matters briefly
- For contact questions: give the exact details (email, LinkedIn, GitHub) directly
- Keep answers focused: 2-5 sentences for simple questions, slightly more for complex ones
- Be warm — make visitors feel they are getting genuinely useful, real information
- Use exact names, job titles, technologies, and dates from the information above — never invent
- If the answer is in the context above, give it confidently — do NOT hedge or say you are unsure

ABSOLUTE RULES:
- NEVER say "I could not read the website", "I am using your form inputs", or mention your own setup
- NEVER say "I am an AI", "as an AI", or add any AI disclaimers
- NEVER invent facts, numbers, or details not in the information above
- ONLY say "I don't have that detail right now" when the topic is genuinely absent from ALL sections above — not just hard to find`.trim();
}

function fallbackReply(message, profile, relevantChunks = []) {
  const text = message.toLowerCase();
  const projectName = profile.projectName || "this business";
  const goals = Array.isArray(profile.goals) ? profile.goals : [];
  const siteLink = profile.websiteUrl ? ` You can find the full details at ${profile.websiteUrl}.` : "";

  const chunkAnswer = buildAnswerFromChunks(relevantChunks, text);
  if (chunkAnswer) return chunkAnswer;

  if (containsAny(text, ["price", "pricing", "cost", "fee", "charge"])) {
    return `Pricing details for ${projectName} aren't loaded into my knowledge base yet. For exact figures, I'd recommend checking the website directly.${siteLink}`;
  }

  if (containsAny(text, ["book", "booking", "appointment", "visit", "demo", "call", "reserve"])) {
    return `Happy to help with bookings for ${projectName}! To schedule something, please reach out directly through the contact page.${siteLink}`;
  }

  if (containsAny(text, ["hours", "open", "timing", "timings", "working"])) {
    return `I don't have the current operating hours on hand — your best bet is to check the website for the latest schedule.${siteLink}`;
  }

  if (containsAny(text, ["service", "services", "offer", "menu", "product", "features"])) {
    const topGoals = goals.slice(0, 3).join(", ");
    return topGoals
      ? `${projectName} focuses on: ${topGoals}. For the complete list of services, check the website.${siteLink}`
      : `For a full breakdown of what ${projectName} offers, the website has all the details.${siteLink}`;
  }

  if (containsAny(text, ["contact", "phone", "email", "reach", "support"])) {
    return `I don't have the contact details loaded right now — please check the website directly.${siteLink}`;
  }

  if (containsAny(text, ["certif", "certificate", "certification"])) {
    return `I don't have the certifications list in my knowledge base at the moment — check the website for the full details.${siteLink}`;
  }

  if (containsAny(text, ["skill", "technology", "tech stack", "language", "framework", "tools"])) {
    return `I don't have the skills details loaded right now — the website will have the complete picture.${siteLink}`;
  }

  if (containsAny(text, ["education", "degree", "university", "college", "study", "academic"])) {
    return `Education details aren't in my knowledge base yet — you can find them on the website.${siteLink}`;
  }

  return `I don't have that specific information right now. You can check the website for the full details.${siteLink}`;
}

function containsAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function selectRelevantChunks(chunks, query, limit = 40) {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return [];

  const scored = chunks
    .map((chunk) => {
      const chunkText = (chunk.text || "").toLowerCase();
      const titleText = [chunk.title, chunk.url].filter(Boolean).join(" ").toLowerCase();
      const fullText = [titleText, chunkText].join(" ");
      const textIsRich = chunkText.length > 80; // has real content, not just a heading repeat

      let score = 0;
      for (const token of queryTokens) {
        // Title match: small bonus
        if (titleText.includes(token)) score += token.length >= 6 ? 2 : 1;
        // Text content match: larger bonus, especially for rich chunks
        if (chunkText.includes(token)) score += token.length >= 6 ? (textIsRich ? 4 : 2) : (textIsRich ? 2 : 1);
      }

      const q = query.toLowerCase();
      // Domain-specific bonuses — only apply to full text so rich chunks win
      if (/experience|work|career|job/.test(q) && /experience|work|career/.test(fullText)) score += textIsRich ? 8 : 3;
      if (/project|portfolio|built|made/.test(q) && /project|portfolio/.test(fullText)) score += textIsRich ? 8 : 3;
      if (/contact|email|phone|reach/.test(q) && /contact|email|linkedin|github/.test(fullText)) score += textIsRich ? 8 : 3;
      if (/certif|certificate|certification/.test(q) && /certif|ibm|google cloud|deloitte|coursera|udemy/.test(fullText)) score += textIsRich ? 14 : 4;
      if (/skill|technolog|stack|language|framework/.test(q) && /skill|react|node|python|javascript|mongodb|sql/.test(fullText)) score += textIsRich ? 14 : 4;
      if (/education|degree|study|academic|university|college|m\.tech|b\.e|btech|mtech/.test(q) && /education|degree|university|college|m\.tech|b\.e/.test(fullText)) score += textIsRich ? 14 : 4;
      return { chunk, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((item) => item.chunk);
}

function selectRelevantSections(sections, query, limit = 30) {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return [];

  const queryLower = query.toLowerCase();
  const scored = sections
    .map((section) => {
      const text = [
        section.kind,
        section.role,
        section.company,
        section.title,
        section.subtitle,
        section.description,
        section.text,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      let score = 0;
      for (const token of queryTokens) {
        if (text.includes(token)) score += token.length >= 6 ? 2 : 1;
      }

      if (/experience|work|career|job|role/.test(queryLower) && /experience|role|career|job|work/.test(text)) score += 6;
      if (/project|projects|portfolio|built|made/.test(queryLower) && /project|portfolio/.test(text)) score += 5;
      if (/contact|email|phone|reach/.test(queryLower) && /contact|email|linkedin|github/.test(text)) score += 6;
      if (/certif|certificate|certification/.test(queryLower) && /certif|ibm|google cloud|deloitte|coursera/.test(text)) score += 8;
      if (/skill|technolog|stack|language|framework/.test(queryLower) && /skill|react|node|python|javascript|mongodb/.test(text)) score += 8;
      if (/education|degree|study|academic|university|college|m\.tech|b\.e/.test(queryLower) && /education|degree|university|m\.tech|b\.e/.test(text)) score += 8;

      return { section, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((item) => item.section);
}

function buildAnswerFromChunks(chunks, query) {
  if (!chunks.length) return "";

  const first = chunks[0];
  const text = cleanText(first.text || "");
  if (!text) return "";

  if (/experience|work|career|job/.test(query)) {
    return limitText(text, 500);
  }

  if (/project|projects|portfolio/.test(query)) {
    return limitText(text, 500);
  }

  if (/contact|email|phone|reach/.test(query)) {
    return limitText(text, 380);
  }

  return limitText(text, 420);
}

function inferDirectAnswerFromChunks(chunks, query) {
  if (!chunks.length) return "";

  const normalizedQuery = String(query || "").toLowerCase();
  const needsRoleAnswer =
    /position|role|job|current role|current position|experience|work/.test(
      normalizedQuery,
    );
  const needsProjectAnswer = /project|projects|portfolio|built|made/.test(
    normalizedQuery,
  );
  const needsContactAnswer = /contact|email|phone|reach/.test(normalizedQuery);

  for (const chunk of chunks) {
    const text = cleanText(chunk.text || "");
    const title = cleanText(chunk.title || "");
    const source = `${title} ${text}`;

    if (needsContactAnswer) {
      const contactMatch = source.match(
        /(?:email|phone|contact|reach)[^.\n]{0,120}/i,
      );
      if (contactMatch) {
        return `From the contact section: ${limitText(contactMatch[0], 240)}`;
      }
    }

    if (needsRoleAnswer) {
      const roleMatch = source.match(
        /([A-Z][A-Za-z0-9,&.\-()\/ ]{2,80})\s+[—-]\s+([A-Z][A-Za-z0-9,&.\-()\/ ]{2,80})/,
      );
      if (roleMatch) {
        return `From the experience page: ${roleMatch[1].trim()} — ${roleMatch[2].trim()}`;
      }

      const roleLine = source.match(
        /(?:full stack developer|software engineer|frontend developer|backend developer|intern|developer|engineer)[^.\n]{0,120}/i,
      );
      if (roleLine) {
        return `From the experience page: ${limitText(roleLine[0], 240)}`;
      }
    }

    if (needsProjectAnswer) {
      const projectLine = source.match(
        /(?:project|portfolio|built|created|developed)[^.\n]{0,160}/i,
      );
      if (projectLine) {
        return `From the project section: ${limitText(projectLine[0], 260)}`;
      }
    }
  }

  return "";
}

function inferDirectAnswerFromSections(sections, query) {
  if (!sections.length) return "";

  const normalizedQuery = String(query || "").toLowerCase();
  const wantsRole =
    /position|role|job|current role|current position|experience|work/.test(
      normalizedQuery,
    );
  const wantsCompany =
    /company|worked at|worked with|employer|organization|where did/.test(
      normalizedQuery,
    );
  const wantsDescription =
    /describe|what did|details|about the role|responsibilities|did he do|did she do/.test(
      normalizedQuery,
    );
  const wantsProject = /project|projects|portfolio|built|made/.test(
    normalizedQuery,
  );
  const wantsContact = /contact|email|phone|reach/.test(normalizedQuery);

  for (const section of sections) {
    if (
      wantsContact &&
      (section.kind === "contact" ||
        /contact/.test(section.title || section.text || ""))
    ) {
      return formatSectionAnswer(section, "contact");
    }

    if (
      wantsRole &&
      (section.kind === "experience" || section.role || section.company)
    ) {
      return formatSectionAnswer(section, "role");
    }

    if (wantsCompany && section.company) {
      return formatSectionAnswer(section, "company");
    }

    if (wantsDescription && section.description) {
      return formatSectionAnswer(section, "description");
    }

    if (
      wantsProject &&
      (section.kind === "project" ||
        /project|portfolio/.test(
          `${section.title || ""} ${section.text || ""}`.toLowerCase(),
        ))
    ) {
      return formatSectionAnswer(section, "project");
    }
  }

  return "";
}

function formatSectionAnswer(section, mode = "role") {
  const role = cleanText(section.role || "");
  const company = cleanText(section.company || "");
  const title = cleanText(section.title || "");
  const description = cleanText(section.description || section.text || "");

  if (mode === "contact") {
    return `From the contact section: ${limitText(description || title, 260)}`;
  }

  if (mode === "project") {
    return `From the project section: ${limitText(description || title, 280)}`;
  }

  if (mode === "description") {
    const parts = [];
    if (role) parts.push(`role ${role}`);
    if (company) parts.push(`company ${company}`);
    if (description) parts.push(`description ${limitText(description, 220)}`);
    if (!parts.length && title) parts.push(title);
    return `From the experience page: ${parts.join(", ")}`;
  }

  if (mode === "company") {
    const parts = [];
    if (company) parts.push(`company ${company}`);
    if (role) parts.push(`role ${role}`);
    if (description) parts.push(`description ${limitText(description, 220)}`);
    if (!parts.length && title) parts.push(title);
    return `From the experience page: ${parts.join(", ")}`;
  }

  const pieces = [];
  if (role) pieces.push(`role ${role}`);
  if (company) pieces.push(`company ${company}`);
  if (!pieces.length && title) pieces.push(title);
  if (description) pieces.push(limitText(description, 220));

  return `From the experience page: ${pieces.join(", ")}`;
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3)
    .slice(0, 24);
}

function formatWebsiteContext(sections = [], chunks = []) {
  const lines = [];

  for (const section of sections) {
    // Puppeteer sections have role, company, description, title, text, kind fields
    const role        = cleanText(section.role || "");
    const company     = cleanText(section.company || "");
    const description = cleanText(section.description || "");
    const title       = cleanText(section.title || "");
    const text        = cleanText(section.text || "");

    // Skip if text is just "section" and no other fields have content
    const bodyText = description || (text.toLowerCase() !== "section" ? text : "") || "";
    if (!bodyText && !role && !company) continue;

    // Build a human-readable line: "Role — Company: description/text"
    const parts = [];
    if (role && company) parts.push(`${role} — ${company}`);
    else if (role)    parts.push(role);
    else if (company) parts.push(company);
    else if (title)   parts.push(title);

    if (bodyText) parts.push(limitText(bodyText, 500));

    if (parts.length) lines.push(parts.join(": "));
  }

  for (const chunk of chunks) {
    const heading = cleanText(chunk.title || chunk.url || "");
    const body    = cleanText(chunk.text || "");
    if (!body || body.length < 10) continue;

    // Skip chunks that are just a navigation/section list (nav menu noise)
    const NAV_WORDS = /^(home|experience|projects|skills|education|certifications|contact|about|services|portfolio|work|blog|testimonials)$/i;
    const bodyLines = body.split(/\n+/).map(l => l.trim()).filter(Boolean);
    const isNavList = bodyLines.length >= 3 && bodyLines.every(l => NAV_WORDS.test(l));
    if (isNavList) continue;

    if (heading && heading.toLowerCase() !== body.toLowerCase()) {
      lines.push(`${heading}: ${limitText(body, 700)}`);
    } else {
      lines.push(limitText(body, 700));
    }
  }

  return lines.join("\n\n");
}

async function fetchWebsiteContext(websiteUrl) {
  const empty = {
    title: "",
    summary: "",
    pages: [],
    sections: [],
    chunks: [],
    topics: [],
  };

  const normalizedUrl = normalizeWebsiteUrl(websiteUrl);
  if (!normalizedUrl) {
    return empty;
  }

  let browser = null;
  try {
    browser = await openPuppeteerBrowser();
    const homepage = await fetchPage(normalizedUrl.toString(), browser);
    if (!homepage || isNotFoundPage(homepage)) {
      return empty;
    }

    const pages = [homepage];

    try {
      const crawledPages = await crawlWebsitePages(
        normalizedUrl,
        homepage,
        browser,
      );
      for (const page of crawledPages) {
        if (page && !isNotFoundPage(page)) {
          pages.push(page);
        }
      }
    } catch {
      // Keep homepage data even if deeper crawling fails.
    }

    try {
      const navigatedPages = await crawlRenderedNavigation(
        normalizedUrl,
        browser,
      );
      for (const page of navigatedPages) {
        if (page && !isNotFoundPage(page)) pages.push(page);
      }
    } catch {
      // Keep homepage data even if rendered navigation fails.
    }

    const uniquePages = dedupePages(pages);
    const safePages = uniquePages.length ? uniquePages : [homepage];

    const title =
      safePages.find((page) =>
        cleanText(page.title || page.description || page.summary),
      )?.title ||
      homepage.title ||
      normalizedUrl.hostname;
    const summary =
      buildCombinedWebsiteSummary(safePages) ||
      homepage.summary ||
      homepage.description ||
      homepage.text ||
      homepage.title ||
      "";
    const topics = extractTopicsFromPages(safePages);
    const chunks = buildWebsiteChunks(safePages);
    const sections = safePages.flatMap((page) =>
      Array.isArray(page.sections) ? page.sections : [],
    );

    if (browser) {
      await browser.close().catch(() => {});
    }

    return {
      title,
      summary,
      pages: safePages.map((page) => ({
        url: page.url,
        title: page.title,
        summary: page.summary,
      })),
      sections,
      chunks,
      topics,
    };
  } catch {
    return empty;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

async function crawlWebsitePages(baseUrl, homepage, browser) {
  const pages = [];
  const seenUrls = new Set();
  const queuedUrls = new Set();
  const queue = [];
  const maxPages = 8;
  const maxDepth = 1;

  function enqueue(url, depth) {
    const normalized = normalizeCrawlUrl(baseUrl, url);
    if (!normalized) return;
    if (seenUrls.has(normalized) || queuedUrls.has(normalized)) return;
    queuedUrls.add(normalized);
    queue.push({ url: normalized, depth });
  }

  function addPage(page) {
    const normalized = normalizeCrawlUrl(baseUrl, page?.url || "");
    if (!normalized || seenUrls.has(normalized)) return false;
    seenUrls.add(normalized);
    pages.push(page);
    return true;
  }

  addPage(homepage);
  for (const candidate of await collectWebsiteCandidates(baseUrl, homepage)) {
    enqueue(candidate, 1);
  }
  for (const link of getFollowableLinks(baseUrl, homepage)) {
    enqueue(link, 1);
  }

  while (queue.length && pages.length < maxPages) {
    const { url, depth } = queue.shift();
    queuedUrls.delete(url);
    if (seenUrls.has(url)) continue;

    const page = await fetchPage(url, browser);
    if (!page || isNotFoundPage(page)) {
      continue;
    }

    addPage(page);
    if (depth >= maxDepth) {
      continue;
    }

    for (const link of getFollowableLinks(baseUrl, page)) {
      enqueue(link, depth + 1);
    }
  }

  return pages;
}

async function getWebsiteContext(websiteUrl, forceRefresh = false) {
  const normalizedUrl = normalizeWebsiteUrl(websiteUrl);
  const key = normalizedUrl ? normalizedUrl.toString() : "";
  if (!key) {
    return {
      title: "",
      summary: "",
      pages: [],
      sections: [],
      chunks: [],
      topics: [],
    };
  }

  if (forceRefresh) {
    websiteContextCache.delete(key);
  }

  const cached = websiteContextCache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt > now && isValidWebsiteContext(cached.value)) {
    return cached.value;
  }

  if (cached) {
    websiteContextCache.delete(key);
  }

  const value = await Promise.race([
    fetchWebsiteContext(key),
    new Promise((resolve) =>
      setTimeout(
        () =>
          resolve({
            title: "",
            summary: "",
            pages: [],
            sections: [],
            chunks: [],
            topics: [],
          }),
        25000,
      ),
    ),
  ]);
  websiteContextCache.set(key, {
    value,
    expiresAt: now + 15 * 60 * 1000,
  });

  return value;
}

// Returns true only if scraped context has at least 2 real, usable text chunks or sections.
// Summary length alone is NOT enough — puppeteer on SPAs always produces a long summary
// even when all chunks are garbage "section" text.
function hasMeaningfulScrapedContext(ctx) {
  if (!ctx) return false;
  const goodChunks = (ctx.chunks || []).filter(c => {
    const t = (c.text || "").trim();
    const ti = (c.title || "").trim();
    return t.length > 40 && t.toLowerCase() !== "section" && t.toLowerCase() !== ti.toLowerCase();
  });
  const goodSections = (ctx.sections || []).filter(s => {
    const t = (s.text || s.description || "").trim();
    return t.length > 40 && t.toLowerCase() !== "section";
  });
  return goodChunks.length >= 2 || goodSections.length >= 2;
}

async function getSimpleWebsiteContext(websiteUrl) {
  const empty = { title: "", summary: "", pages: [], sections: [], chunks: [], topics: [] };
  const normalizedUrl = normalizeWebsiteUrl(websiteUrl);
  if (!normalizedUrl) return empty;

  const urlStr = normalizedUrl.toString();

  // ── Step 1: Fetch homepage via Jina ──
  let homepage = await fetchViaJina(urlStr);
  if (!homepage) {
    try { homepage = await fetchStaticPage(urlStr); } catch { homepage = null; }
  }
  if (!homepage) return empty;

  const pages = [homepage];
  const seenUrls = new Set([urlStr]);

  // ── Step 2: Discover real subpage links from homepage content only ──
  // Do NOT guess routes like /education, /skills — those 404 on SPAs and pollute the context
  const discoveredLinks = extractLinksFromJinaContent(homepage.rawText || homepage.text || "", normalizedUrl);
  console.log(`[scrape] Discovered ${discoveredLinks.length} internal links from homepage`);

  // Only fetch links that were actually found in the page content
  const subUrls = discoveredLinks
    .filter(u => !seenUrls.has(u))
    .slice(0, 8);

  // ── Step 4: Fetch each subpage via Jina in parallel (max 4 at a time) ──
  for (let i = 0; i < subUrls.length; i += 4) {
    const batch = subUrls.slice(i, i + 4);
    const results = await Promise.allSettled(batch.map(u => fetchViaJina(u)));
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        const page = result.value;
        const pageUrl = page.url || "";
        if (!seenUrls.has(pageUrl) && !isNotFoundPage(page) && (page.text || "").length > 150) {
          seenUrls.add(pageUrl);
          pages.push(page);
        } else if (isNotFoundPage(page)) {
          console.log(`[scrape] Skipping 404 page: ${pageUrl}`);
        }
      }
    }
  }

  console.log(`[scrape] Total pages fetched via Jina: ${pages.length}`);

  const allSections = pages.flatMap(p => Array.isArray(p.sections) ? p.sections : []);
  const allChunks   = pages.flatMap(p => Array.isArray(p.chunks)   ? p.chunks   : []);
  const summary     = homepage.summary || homepage.description || (homepage.text || "").slice(0, 1200);

  return {
    title:    homepage.title || normalizedUrl.hostname,
    summary,
    pages:    pages.map(p => ({ url: p.url || urlStr, title: p.title || "", summary: p.description || p.summary || "" })),
    sections: allSections.slice(0, 80),
    chunks:   allChunks.slice(0, 60),
    topics:   extractTopicsFromText(summary + " " + allSections.map(s => s.text).join(" ")),
  };
}

// Extract internal links from raw Jina markdown text
function extractLinksFromJinaContent(text, baseUrl) {
  const links = [];
  // Match markdown links: [text](url)
  const mdLinks = [...(text || "").matchAll(/\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g)];
  for (const m of mdLinks) {
    try {
      const resolved = new URL(m[2]);
      if (resolved.origin === baseUrl.origin) {
        resolved.hash = "";
        const u = resolved.toString();
        if (!isSkippableAssetUrl(u)) links.push(u);
      }
    } catch { /* skip */ }
  }
  return [...new Set(links)];
}

// ── Jina AI reader — converts any URL to clean markdown, no API key needed ──
async function fetchViaJina(url) {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    console.log(`[jina] Fetching: ${jinaUrl}`);
    const res = await fetch(jinaUrl, {
      headers: {
        "Accept":          "text/plain",
        "X-Return-Format": "text",
        "X-No-Cache":      "true",
      },
      signal: AbortSignal.timeout(22000),
    });
    if (!res.ok) {
      console.log(`[jina] HTTP ${res.status} for ${url}`);
      return null;
    }
    const text = await res.text();
    if (!text || text.length < 80) {
      console.log(`[jina] Response too short (${text?.length ?? 0} chars) for ${url}`);
      return null;
    }
    console.log(`[jina] Got ${text.length} chars for ${url}`);
    const parsed = parseJinaMarkdown(text, url);
    console.log(`[jina] Parsed — title: "${parsed.title}", chunks: ${parsed.chunks?.length}, sections: ${parsed.sections?.length}`);
    return parsed;
  } catch (err) {
    console.log(`[jina] Error for ${url}: ${err.message}`);
    return null;
  }
}

// Parse the "Title / URL Source / Markdown Content" format Jina returns
function parseJinaMarkdown(raw, url) {
  // Normalize line endings
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const titleMatch = normalized.match(/^\s*Title:\s*(.+)$/m);
  const title      = titleMatch ? titleMatch[1].trim() : "";

  // Main content is everything after "Markdown Content:"
  const marker    = "Markdown Content:";
  const bodyStart = normalized.indexOf(marker);
  const body      = bodyStart !== -1 ? normalized.slice(bodyStart + marker.length).trim() : normalized;

  // Split into sections by H1/H2/H3 headings
  const sections  = [];
  const headingRe = /^#{1,3}\s+(.+)$/gm;
  const indices   = [];
  for (const m of body.matchAll(headingRe)) {
    indices.push({ heading: m[1].trim(), index: m.index });
  }

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i].index;
    const end   = i + 1 < indices.length ? indices[i + 1].index : body.length;
    // Strip the heading line itself, keep links as plain text
    const text  = body.slice(start, end)
      .replace(/^#{1,3}\s+.+\n?/, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")  // links → text only
      .replace(/[*_`>]/g, "")
      .trim();
    if (text.length > 30) {
      sections.push({ title: indices[i].heading, text: text.slice(0, 2000), url, kind: "section" });
    }
  }

  // Build paragraph-level chunks from the cleaned body
  const cleanBody = body
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>]/g, "")
    .replace(/\n{3,}/g, "\n\n");

  const paragraphs = cleanBody.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 40);
  const chunks = paragraphs.slice(0, 60).map(p => ({
    url,
    title: title || url,
    text: p.slice(0, 1200),
  }));

  const plainText = cleanBody.replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim();
  const summary   = plainText.slice(0, 1500);

  return {
    url,
    title,
    description: plainText.slice(0, 300),
    summary,
    text:    plainText,
    rawText: body,   // keep raw for link extraction
    sections,
    chunks,
    links: [],
  };
}

// Simple topic extraction from combined text
function extractTopicsFromText(text) {
  if (!text) return [];
  const stopWords = new Set(["the","and","for","are","was","were","this","that","with","from","have","has","its","our","your","their","which","about","will","can","not","but","all","more","also","they","what","when","who","how","why","some","than","into","been","out","over","other","each","such","these","those","then","than","just","like","very","too","only","even","well","now","new","make","made","any","may","use","used","using","one","two","three","four","five"]);
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const freq = {};
  for (const w of words) { if (!stopWords.has(w)) freq[w] = (freq[w] || 0) + 1; }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w]) => w);
}

async function collectWebsiteCandidates(baseUrl, homepage) {
  const candidates = new Set();

  for (const url of discoverRelevantUrls(baseUrl, homepage)) {
    if (!isSkippableAssetUrl(url)) {
      candidates.add(url);
    }
  }
  for (const url of await discoverSitemapUrls(baseUrl)) {
    if (!isSkippableAssetUrl(url)) {
      candidates.add(url);
    }
  }

  for (const url of discoverLikelyRoutes(baseUrl)) {
    if (!isSkippableAssetUrl(url)) {
      candidates.add(url);
    }
  }

  return [...candidates].filter(Boolean);
}

function getFollowableLinks(baseUrl, page) {
  const links = Array.isArray(page?.links) ? page.links : [];
  const candidates = new Map();

  for (const link of links) {
    const rawHref = String(link?.href || "").trim();
    if (!rawHref) continue;
    if (/^(mailto:|tel:|javascript:|#)/i.test(rawHref)) continue;

    try {
      const resolved = new URL(rawHref, baseUrl);
      if (resolved.origin !== baseUrl.origin) continue;
      resolved.hash = "";
      const normalized = resolved.toString();
      if (!normalized || isSkippableAssetUrl(normalized)) continue;

      const text = cleanText(link?.text || "").toLowerCase();
      const score = scoreCrawlLink(normalized, text);
      const previous = candidates.get(normalized) || -1;
      if (score > previous) {
        candidates.set(normalized, score);
      }
    } catch {
      // ignore invalid links
    }
  }

  return [...candidates.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([url]) => url);
}

function scoreCrawlLink(url, text = "") {
  const href = String(url || "").toLowerCase();
  const haystack = `${href} ${text}`;
  const keywordWeights = [
    ["experience", 8],
    ["projects", 8],
    ["project", 8],
    ["portfolio", 8],
    ["services", 7],
    ["service", 7],
    ["pricing", 7],
    ["price", 7],
    ["contact", 7],
    ["about", 6],
    ["faq", 6],
    ["support", 6],
    ["skills", 6],
    ["education", 6],
    ["certification", 5],
    ["blog", 4],
    ["docs", 4],
    ["documentation", 4],
    ["solutions", 4],
  ];

  let score = 0;
  for (const [keyword, weight] of keywordWeights) {
    if (haystack.includes(keyword)) score += weight;
  }

  const pathDepth = href.split("/").filter(Boolean).length;
  if (pathDepth === 1) score += 2;
  if (pathDepth === 2) score += 1;
  if (pathDepth >= 4) score -= 1;
  if (/index\.html?$/.test(href)) score -= 2;
  return score;
}

function normalizeCrawlUrl(baseUrl, input) {
  try {
    const resolved = new URL(String(input || ""), baseUrl);
    if (resolved.origin !== baseUrl.origin) return "";
    resolved.hash = "";
    if (isSkippableAssetUrl(resolved.toString())) return "";
    return resolved.toString();
  } catch {
    return "";
  }
}

async function crawlRenderedNavigation(baseUrl, browser) {
  if (!browser) {
    return [];
  }

  const page = await browser.newPage({
    viewport: { width: 1440, height: 2200 },
    userAgent: "Mozilla/5.0 (compatible; OwnChatbotAgent/1.0)",
  });

  const pages = [];
  const seen = new Set();

  try {
    try {
      await page.goto(baseUrl.toString(), {
        waitUntil: "networkidle2",
        timeout: 20000,
      });
    } catch {
      try {
        await page.goto(baseUrl.toString(), {
          waitUntil: "load",
          timeout: 15000,
        });
      } catch {
        // proceed and try to read whatever loaded
      }
    }
    await autoScrollPage(page);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const homepage = await loadRenderedPageFromCurrentState(
      page,
      baseUrl.toString(),
    );
    if (!homepage) {
      return [];
    }

    addUniqueRenderedPage(pages, seen, homepage);

    const labels = await discoverRenderedNavigationLabels(page);
    const fallbackLabels = [
      "experience",
      "projects",
      "skills",
      "education",
      "certifications",
      "contact",
      "about",
      "portfolio",
      "resume",
    ];
    const crawlLabels = [...new Set([...labels, ...fallbackLabels])];

    for (const label of crawlLabels) {
      try {
        await page.goto(baseUrl.toString(), {
          waitUntil: "networkidle2",
          timeout: 20000,
        });
      } catch {
        try {
          await page.goto(baseUrl.toString(), {
            waitUntil: "load",
            timeout: 15000,
          });
        } catch {
          // if homepage reload fails, try clicking from the current state
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
      const clicked = await clickRenderedNavigation(page, label);
      if (!clicked) continue;

      await autoScrollPage(page);
      await new Promise((resolve) => setTimeout(resolve, 4000));
      const state = await loadRenderedPageFromCurrentState(page, page.url());
      addUniqueRenderedPage(pages, seen, state);
    }
  } catch {
    // ignore navigation crawl failures
  } finally {
    await page.close().catch(() => {});
  }

  return pages;
}

async function discoverRenderedNavigationLabels(page) {
  try {
    return await page.evaluate(() => {
      const selectors = [
        "nav a",
        "nav button",
        "header a",
        "header button",
        "a",
        "button",
        "[role='button']",
        "li",
        "span",
      ];
      const stopWords = new Set([
        "home",
        "menu",
        "open",
        "close",
        "more",
        "read more",
        "learn more",
        "view more",
        "contact me",
        "download cv",
        "download resume",
        "hire me",
        "submit",
      ]);
      const labels = [];
      const seen = new Set();

      for (const selector of selectors) {
        const elements = Array.from(document.querySelectorAll(selector));
        for (const el of elements) {
          const text = String(el.textContent || "")
            .replace(/\s+/g, " ")
            .trim();
          if (!text || text.length < 2 || text.length > 40) continue;
          if (
            /\b(home|menu|open|close|read more|learn more|view more)\b/i.test(
              text,
            )
          )
            continue;
          const normalized = text.toLowerCase();
          if (stopWords.has(normalized) || seen.has(normalized)) continue;
          seen.add(normalized);
          labels.push(text);
        }
      }

      return labels.slice(0, 24);
    });
  } catch {
    return [];
  }
}

async function clickRenderedNavigation(page, label) {
  const selectors = ["a", "button", "[role='button']", "li", "span", "div"];

  for (const selector of selectors) {
    const clicked = await page.evaluate(
      (sel, exactStr, fuzzyStr) => {
        const exactRe = new RegExp(exactStr, "i");
        const fuzzyRe = new RegExp(fuzzyStr, "i");
        const els = Array.from(document.querySelectorAll(sel));

        for (const el of els) {
          if (exactRe.test(el.textContent)) {
            el.click();
            return true;
          }
        }
        for (const el of els) {
          if (fuzzyRe.test(el.textContent)) {
            el.click();
            return true;
          }
        }
        return false;
      },
      selector,
      `^\\s*${escapeRegExp(label)}\\s*$`,
      escapeRegExp(label),
    );

    if (clicked) return true;
  }

  return false;
}

async function loadRenderedPageFromCurrentState(page, url) {
  try {
    const html = await page.content();
    const details = extractWebsiteContextFromHtml(html, page.url() || url);
    if (isNotFoundPage(details)) {
      return null;
    }
    return {
      url: page.url() || url,
      html,
      ...details,
    };
  } catch {
    return null;
  }
}

async function autoScrollPage(page) {
  try {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const step = Math.max(240, Math.floor(window.innerHeight * 0.7));
        const maxSteps = 20;
        let steps = 0;

        const timer = setInterval(() => {
          const scrollHeight =
            document.body?.scrollHeight ||
            document.documentElement?.scrollHeight ||
            0;
          window.scrollBy(0, step);
          totalHeight += step;
          steps += 1;

          if (steps >= maxSteps || totalHeight >= scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 250);
      });
    });
  } catch {
    // ignore scroll failures
  }
}

function addUniqueRenderedPage(pages, seen, page) {
  if (!page || isNotFoundPage(page)) return;
  const key = [page.url, page.title, page.summary]
    .map((value) => cleanText(value || ""))
    .join(" | ");
  if (!key || seen.has(key)) return;
  seen.add(key);
  pages.push(page);
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fetchPage(url, browser = null) {
  if (isSkippableAssetUrl(url)) {
    return null;
  }

  try {
    const rendered = await fetchRenderedPage(url, browser);
    if (rendered) {
      return rendered;
    }

    return await fetchStaticPage(url);
  } catch {
    return null;
  }
}

async function openPuppeteerBrowser() {
  const puppeteer = await loadPuppeteer();
  if (!puppeteer) {
    return null;
  }

  try {
    return await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  } catch {
    return null;
  }
}

async function fetchRenderedPage(url, browser = null) {
  if (!browser) {
    return null;
  }

  let page = null;
  try {
    page = await browser.newPage({
      viewport: { width: 1440, height: 2200 },
      userAgent: "Mozilla/5.0 (compatible; OwnChatbotAgent/1.0)",
    });

    let response;
    try {
      response = await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 15000,
      });
    } catch {
      try {
        response = await page.goto(url, { waitUntil: "load", timeout: 10000 });
      } catch {
        // proceed anyway
      }
    }

    await autoScrollPage(page);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for SPA renders

    const contentType = String(
      response?.headers()?.["content-type"] || "",
    ).toLowerCase();
    const currentUrl = String(page.url() || url).toLowerCase();

    if (
      currentUrl.endsWith(".pdf") ||
      contentType.includes("application/pdf") ||
      contentType.includes("application/octet-stream") ||
      contentType.includes("application/zip")
    ) {
      await page.close().catch(() => {});
      return null;
    }

    let data = null;
    try {
      data = await page.evaluate(() => {
        const title = document.title || "";
        const description =
          document
            .querySelector('meta[name="description"]')
            ?.getAttribute("content") || "";
        const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
          .map((el) => (el.textContent || "").trim())
          .filter(Boolean)
          .slice(0, 12);
        const text = (
          document.body?.innerText ||
          document.documentElement?.innerText ||
          ""
        )
          .replace(/\s+/g, " ")
          .trim();
        const links = Array.from(document.querySelectorAll("a[href]"))
          .map((a) => ({
            href: a.href || "",
            text: (a.textContent || "").trim(),
          }))
          .filter((link) => link.href);

        return {
          title,
          description,
          headings,
          text,
          links,
          sections: extractStructuredSections(),
          html: document.documentElement.outerHTML,
        };

        function extractStructuredSections() {
          const root =
            document.querySelector("main") ||
            document.body ||
            document.documentElement;
          const candidates = Array.from(
            root.querySelectorAll(
              "section, article, li, [class*='card'], [class*='experience'], [class*='project'], [class*='skill'], [class*='education'], [class*='contact'], [class*='certificat']",
            ),
          );
          const seen = new Set();
          const sections = [];

          for (const el of candidates) {
            if (!isVisible(el)) continue;
            if (el.closest("nav, header, footer, aside")) continue;

            const rawText = cleanInline(el.innerText || el.textContent || "");
            if (rawText.length < 40 || rawText.length > 1200) continue;
            if (
              /^(home|experience|projects|skills|education|certifications|contact)$/i.test(
                rawText,
              )
            )
              continue;

            const headingTexts = Array.from(
              el.querySelectorAll("h1, h2, h3, h4, strong, b"),
            )
              .map((node) => cleanInline(node.textContent || ""))
              .filter(Boolean);
            const heading = headingTexts[0] || "";
            const [primary, secondary] = splitTitle(heading || rawText);
            const paragraphTexts = Array.from(
              el.querySelectorAll(
                "p, li, [class*='desc'], [class*='text'], [class*='content']",
              ),
            )
              .map((node) => cleanInline(node.textContent || ""))
              .filter(
                (value) =>
                  value &&
                  value.length > 15 &&
                  !/^(view resume|download|view|read more|learn more)$/i.test(
                    value,
                  ),
              );
            const linkTexts = Array.from(el.querySelectorAll("a[href], button"))
              .map((node) => cleanInline(node.textContent || ""))
              .filter(
                (value) =>
                  value &&
                  !/^(view resume|download|view|read more|learn more)$/i.test(
                    value,
                  ),
              );

            const description =
              cleanInline(paragraphTexts.join(" ")) ||
              cleanInline(
                rawText
                  .replace(heading, "")
                  .replace(/view resume|download|read more|learn more/gi, " "),
              );

            const kind = inferSectionKind(el, primary, description);
            const role = extractRoleName(primary, secondary, description, kind);
            const company = extractCompanyName(
              primary,
              secondary,
              description,
              kind,
              role,
            );
            const normalized = cleanInline(
              [kind, role, company, description].filter(Boolean).join(" "),
            );
            if (!normalized || seen.has(normalized)) continue;
            seen.add(normalized);

            sections.push({
              kind,
              title: primary || heading || rawText.slice(0, 80),
              subtitle: secondary || "",
              role,
              company,
              description: description || rawText,
              text: normalized,
              links: linkTexts.slice(0, 4),
            });
          }

          return sections.slice(0, 40);
        }

        function isVisible(el) {
          const style = window.getComputedStyle(el);
          return (
            style &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0"
          );
        }

        function cleanInline(value) {
          return String(value || "")
            .replace(/\s+/g, " ")
            .replace(/[\u200B-\u200D\uFEFF]/g, "")
            .trim();
        }

        function splitTitle(value) {
          const text = cleanInline(value);
          if (!text) return ["", ""];
          const separators = [" — ", " - ", " | ", " / ", " : "];
          for (const separator of separators) {
            if (text.includes(separator)) {
              const [first, ...rest] = text.split(separator);
              return [cleanInline(first), cleanInline(rest.join(separator))];
            }
          }
          return [text, ""];
        }

        function inferSectionKind(el, title, description) {
          const blob =
            `${el.className || ""} ${title || ""} ${description || ""}`.toLowerCase();
          if (/experience|work|career|intern|developer|engineer/.test(blob))
            return "experience";
          if (/project|portfolio|built|created|developed/.test(blob))
            return "project";
          if (/skill|stack|tech|technology/.test(blob)) return "skill";
          if (/education|school|college|university|degree/.test(blob))
            return "education";
          if (/certif|award/.test(blob)) return "certification";
          if (/contact|email|phone|reach/.test(blob)) return "contact";
          return "section";
        }

        function extractRoleName(primary, secondary, description, kind) {
          if (kind !== "experience") return "";
          const candidates = [primary, secondary, description].filter(Boolean);
          for (const candidate of candidates) {
            const match = candidate.match(
              /(?:full stack developer|software engineer|frontend developer|backend developer|developer|engineer|intern)[^,.;\n]*/i,
            );
            if (match) return cleanInline(match[0]);
          }
          if (primary) return cleanInline(primary);
          return "";
        }

        function extractCompanyName(primary, secondary, description) {
          const combined = [primary, secondary, description]
            .filter(Boolean)
            .join(" ");
          const companyPatterns = [
            /(?:at|@|for)\s+([A-Z][A-Za-z0-9&.\-() ]{2,80})/i,
            /([A-Z][A-Za-z0-9&.\-() ]{2,80})\s+[—\-|]\s+(?:full stack developer|software engineer|frontend developer|backend developer|developer|engineer|intern)/i,
          ];
          for (const pattern of companyPatterns) {
            const match = combined.match(pattern);
            if (match && match[1]) return cleanInline(match[1]);
          }
          return "";
        }
      });
    } catch {
      data = null;
    }

    if (!data) {
      const fallbackHtml = await page.content().catch(() => "");
      const fallbackDetails = extractWebsiteContextFromHtml(
        fallbackHtml,
        page.url() || url,
      );
      data = {
        title: fallbackDetails.title || "",
        description: fallbackDetails.description || "",
        headings: Array.isArray(fallbackDetails.headings)
          ? fallbackDetails.headings
          : [],
        text: fallbackDetails.text || "",
        links: Array.isArray(fallbackDetails.links)
          ? fallbackDetails.links
          : [],
        sections: Array.isArray(fallbackDetails.sections)
          ? fallbackDetails.sections
          : [],
        html: fallbackHtml || "",
      };
    }

    const renderedText = cleanText(data.text || "");
    if (looksLikeBinaryText(renderedText) || hasPdfNoise(renderedText)) {
      await page.close().catch(() => {});
      return null;
    }

    if (isNotFoundText(data.title, renderedText)) {
      await page.close().catch(() => {});
      return null;
    }

    return {
      url,
      html: data.html || "",
      title: cleanText(data.title || ""),
      description: cleanText(data.description || ""),
      headings: Array.isArray(data.headings)
        ? data.headings.map(cleanText).filter(Boolean)
        : [],
      text:
        renderedText.length > 50
          ? renderedText
          : cleanText(
              (data.html || "")
                .replace(/<script[\s\S]*?<\/script>/gi, " ")
                .replace(/<style[\s\S]*?<\/style>/gi, " ")
                .replace(/<[^>]+>/g, " "),
            ),
      summary: limitText(
        [
          data.title,
          data.description,
          ...(Array.isArray(data.headings) ? data.headings : []),
          data.text,
        ]
          .filter(Boolean)
          .join(" "),
        8000,
      ),
      links: Array.isArray(data.links)
        ? data.links
            .map((link) => ({
              href: link.href,
              text: cleanText(link.text || ""),
            }))
            .filter((link) => link.href)
        : [],
      sections: Array.isArray(data.sections)
        ? data.sections
            .map((section) => normalizeSection(section, url))
            .filter(Boolean)
        : [],
    };
  } catch {
    return null;
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

// Extract readable text from a minified React/Vue/Angular JS bundle
async function fetchSpaBundleContent(html, pageUrl) {
  try {
    // Find main JS bundle src from <script> tags
    const scriptMatches = [...html.matchAll(/<script[^>]+src=["']([^"']+\.js[^"']*)["']/gi)];
    const bundleUrls = scriptMatches
      .map(m => { try { return new URL(m[1], pageUrl).toString(); } catch { return null; } })
      .filter(Boolean);

    if (!bundleUrls.length) return null;

    // Fetch all bundles in parallel (up to 3)
    const bundles = await Promise.all(
      bundleUrls.slice(0, 3).map(async (bundleUrl) => {
        try {
          const ctrl = new AbortController();
          setTimeout(() => ctrl.abort(), 8000);
          const res = await fetch(bundleUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
            signal: ctrl.signal
          });
          return res.ok ? await res.text() : "";
        } catch { return ""; }
      })
    );

    const fullBundle = bundles.join(" ");
    if (!fullBundle) return null;

    // Extract text from React JSX children patterns and structured data objects
    const seen = new Set();
    const lines = [];

    const BAD = /className|style|onClick|onChange|onSubmit|useState|useEffect|useRef|import|export|require|module|webpack|__vite|http[s]?:|<[a-z]|\$\{|=>|function|const |let |var |return |\.jsx|\.tsx|\.css/;

    function addLine(t) {
      t = t.trim();
      if (t.length < 2) return;
      if (seen.has(t)) return;
      if (BAD.test(t)) return;
      seen.add(t);
      lines.push(t);
    }

    // children:"..." — JSX text nodes
    for (const m of fullBundle.matchAll(/children:"([^"]{3,500})"/g)) addLine(m[1]);

    // Structured data object properties (portfolio/resume data patterns)
    const dataProps = "title|name|label|text|heading|description|summary|bio|about|role|position|company|employer|organization|institution|institute|degree|field|major|program|stream|branch|specialization|school|university|college|certificate|certification|course|project|skill|technology|stack|tech|email|phone|mobile|contact|location|address|city|country|year|date|duration|period|from|to|start|end|score|grade|cgpa|gpa|achievement|responsibility|detail|highlight";
    for (const m of fullBundle.matchAll(new RegExp(`(?:${dataProps}):"([^"]{2,500})"`, "g"))) addLine(m[1]);

    // Single-quoted string property values
    for (const m of fullBundle.matchAll(new RegExp(`(?:${dataProps}):'([^']{2,500})'`, "g"))) addLine(m[1]);

    // aria-label, placeholder, alt text
    for (const m of fullBundle.matchAll(/(?:aria-label|placeholder|alt):"([^"]{5,200})"/g)) addLine(m[1]);

    // String array items (likely skill lists, tech stacks, etc.) — quoted strings 3-80 chars in array context
    for (const m of fullBundle.matchAll(/\["([^"]{3,80})"/g)) addLine(m[1]);
    for (const m of fullBundle.matchAll(/,"([^"]{3,80})"/g)) {
      // Only if it looks like a plain word/phrase, not a CSS/JS token
      const t = m[1].trim();
      if (t.length >= 3 && !BAD.test(t) && /^[A-Za-z]/.test(t)) addLine(t);
    }

    if (!lines.length) return null;

    return lines.join("\n");
  } catch {
    return null;
  }
}

async function fetchStaticPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    return null;
  }

  const contentType = (
    response.headers.get("content-type") || ""
  ).toLowerCase();
  if (
    !contentType.includes("text/html") &&
    !contentType.includes("application/xhtml+xml") &&
    !contentType.includes("text/plain")
  ) {
    return null;
  }

  const html = await response.text();
  if (looksLikeBinaryText(html)) {
    return null;
  }
  if (hasPdfNoise(html)) {
    return null;
  }

  let details = extractWebsiteContextFromHtml(html, url);
  if (isNotFoundPage(details)) return null;

  // SPA detection: if body text is nearly empty, extract from JS bundle
  const bodyTextLen = (details.text || "").length;
  if (bodyTextLen < 200) {
    const spaText = await fetchSpaBundleContent(html, url);
    if (spaText && spaText.length > 100) {
      const lines = spaText.split("\n").filter(Boolean);
      const headings = lines.filter(l => l.length < 120);
      const paragraphs = lines.filter(l => l.length >= 40);
      const summaryParts = [details.description, ...headings.slice(0, 20), ...paragraphs.slice(0, 15)].filter(Boolean);

      // Group lines by heading: each heading gets the lines that follow until next heading
      // A heading is short, starts with a capital, and doesn't contain data markers (–, •, @, 4-digit year)
      const isHeadingLine = (l) =>
        l.length < 60 && /^[A-Z]/.test(l) && !/[–—•|@]/.test(l) && !/\d{4}/.test(l);
      const sections = [];
      let currentHeading = null;
      let currentLines = [];
      for (const line of lines) {
        if (isHeadingLine(line)) {
          if (currentHeading) {
            sections.push({ title: currentHeading, text: [currentHeading, ...currentLines].join(" "), kind: "section" });
          }
          currentHeading = line;
          currentLines = [];
        } else {
          currentLines.push(line);
        }
      }
      if (currentHeading) {
        sections.push({ title: currentHeading, text: [currentHeading, ...currentLines].join(" "), kind: "section" });
      }

      details = {
        ...details,
        text: spaText,
        headings: headings.slice(0, 30),
        summary: limitText(summaryParts.join(" "), 5000),
        sections: sections.slice(0, 30),
      };
    }
  }

  return { url, html, ...details };
}

function extractWebsiteContextFromHtml(html, url = "") {
  // Title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = cleanText(titleMatch?.[1] || "");

  // Meta description
  const descMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i) ||
    html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["'][^>]*>/i);
  const description = cleanText(descMatch?.[1] || "");

  // OG description fallback
  const ogDescMatch =
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i) ||
    html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+property=["']og:description["'][^>]*>/i);
  const ogDescription = cleanText(ogDescMatch?.[1] || "");

  // Helper: strip all HTML tags from a string then clean
  function stripTags(s) {
    return cleanText(String(s || "").replace(/<[^>]+>/g, " "));
  }

  // All headings h1-h4
  const headings = [...html.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean);

  // Strip noise tags then extract all readable text
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // Extract paragraphs
  const paragraphs = [...stripped.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((t) => t.length > 30);

  // Extract list items
  const listItems = [...stripped.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((t) => t.length > 20 && t.length < 300);

  // Full body text (fallback)
  const bodyText = cleanText(stripped.replace(/<[^>]+>/g, " "));

  // Build rich summary: meta description + headings + paragraphs + list items
  const summaryParts = [
    description || ogDescription,
    headings.slice(0, 15).join(". "),
    paragraphs.slice(0, 20).join(" "),
    listItems.slice(0, 20).join(" "),
  ].filter(Boolean);

  const summary = limitText(summaryParts.join(" "), 5000);

  // Build sections from headings + following paragraphs
  const sections = extractSectionsFromHtml(html, url);

  return {
    title,
    description: description || ogDescription,
    headings,
    text: limitText(bodyText, 8000),
    summary,
    url,
    links: extractLinksFromHtml(html, url),
    sections,
  };
}

function extractLinksFromHtml(html, baseUrl) {
  const links = [];

  for (const match of html.matchAll(
    /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const href = match[1].trim();
    const text = cleanText(match[2]);

    try {
      const resolved = new URL(href, baseUrl);
      links.push({
        href: resolved.toString(),
        text,
      });
    } catch {
      // ignore invalid links
    }
  }

  return links;
}

function discoverRelevantUrls(baseUrl, source) {
  const keywords = [
    "about",
    "service",
    "services",
    "pricing",
    "price",
    "plan",
    "faq",
    "contact",
    "portfolio",
    "product",
    "products",
    "solution",
    "solutions",
    "features",
    "experience",
    "work",
    "projects",
    "resume",
    "testimonials",
    "blog",
    "articles",
    "news",
    "resources",
    "docs",
    "documentation",
    "support",
  ];

  const keywordLinks = new Set();
  const otherLinks = new Set();

  const sourceLinks = Array.isArray(source?.links) ? source.links : [];

  for (const link of sourceLinks) {
    const href = String(link.href || "");
    const text = cleanText(link.text || "").toLowerCase();
    const haystack = `${href} ${text}`;

    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.origin === baseUrl.origin && !resolved.hash) {
        if (keywords.some((keyword) => haystack.includes(keyword))) {
          keywordLinks.add(resolved.toString());
        } else {
          otherLinks.add(resolved.toString());
        }
      }
    } catch {
      // ignore invalid links
    }
  }

  return [...keywordLinks, ...otherLinks];
}

function discoverLikelyRoutes(baseUrl) {
  const routes = [
    "/experience",
    "/projects",
    "/skills",
    "/education",
    "/certifications",
    "/contact",
    "/about",
    "/portfolio",
  ];

  return routes.map((route) => new URL(route, baseUrl).toString());
}

async function discoverSitemapUrls(baseUrl) {
  const candidates = new Set();
  const rootSitemaps = [
    new URL("/sitemap.xml", baseUrl).toString(),
    new URL("/sitemap_index.xml", baseUrl).toString(),
  ];

  const robotsUrl = new URL("/robots.txt", baseUrl).toString();

  try {
    const robotsResponse = await fetch(robotsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OwnChatbotAgent/1.0)",
      },
    });

    if (robotsResponse.ok) {
      const robotsText = await robotsResponse.text();
      for (const match of robotsText.matchAll(/^sitemap:\s*(.+)$/gim)) {
        const sitemapValue = match[1].trim();
        try {
          candidates.add(new URL(sitemapValue, baseUrl).toString());
        } catch {
          // ignore invalid sitemap entries
        }
      }
    }
  } catch {
    // ignore robots failures
  }

  for (const sitemapUrl of [...candidates, ...rootSitemaps]) {
    const urls = await parseSitemapUrls(sitemapUrl, baseUrl.origin);
    for (const url of urls) {
      candidates.add(url);
    }
  }

  return [...candidates].filter(Boolean);
}

async function parseSitemapUrls(sitemapUrl, origin) {
  try {
    const response = await fetch(sitemapUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OwnChatbotAgent/1.0)",
      },
    });

    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    const locs = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) =>
      match[1].trim(),
    );

    const pageUrls = [];
    const sitemapUrls = [];

    for (const loc of locs) {
      try {
        const parsed = new URL(loc, sitemapUrl);
        if (parsed.origin !== origin) continue;

        if (/sitemap/i.test(loc)) {
          sitemapUrls.push(parsed.toString());
        } else {
          pageUrls.push(parsed.toString());
        }
      } catch {
        // ignore invalid URLs
      }
    }

    if (sitemapUrls.length) {
      for (const nestedSitemap of sitemapUrls.slice(0, 3)) {
        const nestedUrls = await parseSitemapUrls(nestedSitemap, origin);
        pageUrls.push(...nestedUrls);
      }
    }

    return pageUrls;
  } catch {
    return [];
  }
}

function buildCombinedWebsiteSummary(pages) {
  const parts = [];

  for (const page of pages) {
    const pageLabel = page.title || page.url;
    const pageSummary =
      page.summary || page.description || page.headings?.join(", ") || "";
    if (pageSummary) {
      parts.push(`${pageLabel}: ${pageSummary}`);
    }
  }

  return limitText(parts.join(" | "), 6000);
}

function dedupePages(pages) {
  const seen = new Set();
  const unique = [];

  for (const page of pages) {
    const key = [
      cleanText(page?.url || ""),
      cleanText(page?.title || ""),
      cleanText(page?.summary || ""),
      cleanText(page?.text || "").slice(0, 120),
    ].join(" | ");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(page);
  }

  return unique;
}

function buildWebsiteChunks(pages) {
  return pages
    .flatMap((page) => {
      const sectionChunks = Array.isArray(page.sections)
        ? page.sections.map((section) => ({
            url: page.url,
            title: section.title || section.role || page.title || page.url,
            text: cleanText(
              [
                section.text,
                section.description,
                section.title,
                section.role,
                section.company,
                section.subtitle,
                section.kind !== "section" ? section.kind : null,
                ...(section.links || []),
              ]
                .filter(Boolean)
                .join(" "),
            ),
            role: section.role || "",
            company: section.company || "",
            kind: section.kind || "section",
            description: section.description || "",
          }))
        : [];

      const text = cleanText(
        [
          page.title,
          page.description,
          ...(page.headings || []),
          page.text || page.summary,
        ]
          .filter(Boolean)
          .join(" "),
      );

      if (!text || looksLikeBinaryText(text) || hasPdfNoise(text)) {
        return sectionChunks;
      }

      if (isNotFoundText(page.title, text)) {
        return sectionChunks;
      }

      const chunks = chunkText(text, 1200, 180);
      const textChunks = chunks.map((chunk, index) => ({
        url: page.url,
        title: `${page.title || page.url}${chunks.length > 1 ? ` (part ${index + 1})` : ""}`,
        text: chunk,
      }));

      return [...sectionChunks, ...textChunks];
    })
    .filter(Boolean);
}

function chunkText(text, size = 1200, overlap = 160) {
  const chunks = [];
  const source = String(text || "").trim();
  if (!source) return chunks;

  let start = 0;
  while (start < source.length) {
    const end = Math.min(source.length, start + size);
    chunks.push(source.slice(start, end).trim());
    if (end >= source.length) break;
    start = Math.max(0, end - overlap);
  }

  return chunks;
}

function extractTopicsFromPages(pages) {
  const tokens = new Set();
  const blacklist = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "from",
    "this",
    "your",
    "are",
    "our",
    "you",
    "can",
    "is",
    "to",
    "of",
    "in",
    "a",
    "an",
    "on",
    "we",
    "it",
    "as",
    "be",
    "or",
    "by",
    "at",
    "have",
    "has",
    "not",
    "all",
    "more",
    "about",
    "contact",
    "home",
    "page",
    "website",
    "services",
  ]);

  for (const page of pages) {
    const text = [
      page.title,
      page.description,
      ...(page.headings || []),
      page.summary,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    for (const word of text.split(/[^a-z0-9]+/g)) {
      if (word.length < 4 || blacklist.has(word)) continue;
      tokens.add(word);
      if (tokens.size >= 18) break;
    }

    if (tokens.size >= 18) break;
  }

  return [...tokens];
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeWebsiteUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(raw)
    ? raw
    : `https://${raw.replace(/^\/\//, "")}`;

  try {
    const parsed = new URL(withProtocol);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function limitText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

let puppeteerLoadPromise;

async function loadPuppeteer() {
  if (!puppeteerLoadPromise) {
    puppeteerLoadPromise = import("puppeteer")
      .then((module) => module.default || module)
      .catch(() => null);
  }

  return puppeteerLoadPromise;
}

function isSkippableAssetUrl(url) {
  const clean = String(url || "")
    .toLowerCase()
    .split("?")[0];
  return /\.(pdf|png|jpe?g|gif|webp|svg|zip|rar|7z|mp4|mov|mp3|wav|css|js|json|xml)$/i.test(
    clean,
  );
}

function looksLikeBinaryText(text) {
  const sample = String(text || "").slice(0, 5000);
  if (!sample) return false;
  if (sample.includes("%PDF-")) return true;

  const controlChars = (sample.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || [])
    .length;
  return controlChars > Math.max(12, sample.length * 0.03);
}

function hasPdfNoise(text) {
  const sample = String(text || "").slice(0, 8000);
  return /(?:\bendstream\b|\bendobj\b|\bxref\b|\btrailer\b|\bstartxref\b|\b%%EOF\b|\bstream\b)/i.test(
    sample,
  );
}

function isValidWebsiteContext(context) {
  if (!context || typeof context !== "object") return false;

  const summary = String(context.summary || "");
  if (looksLikeBinaryText(summary) || hasPdfNoise(summary)) {
    return false;
  }

  const pages = Array.isArray(context.pages) ? context.pages : [];
  const sections = Array.isArray(context.sections) ? context.sections : [];
  if (pages.length <= 1 && sections.length === 0) {
    return false;
  }

  const chunks = Array.isArray(context.chunks) ? context.chunks : [];
  return chunks.every((chunk) => {
    const text = String(chunk?.text || "");
    return text && !looksLikeBinaryText(text) && !hasPdfNoise(text);
  });
}

function isNotFoundPage(page) {
  if (!page) return true;
  return isNotFoundText(
    page.title,
    [page.summary, page.text, page.description].filter(Boolean).join(" "),
  );
}

function isNotFoundText(title, text) {
  const combined = `${title || ""} ${text || ""}`.toLowerCase();
  return (
    combined.includes("404") ||
    combined.includes("not_found") ||
    combined.includes("not found") ||
    combined.includes("page not found") ||
    combined.includes("this page could not be found") ||
    combined.includes("could not be found") ||
    combined.includes("page doesn't exist") ||
    combined.includes("read our documentation to learn more about this error")
  );
}

function normalizeSection(section, url) {
  if (!section || typeof section !== "object") return null;
  const title = cleanText(section.title || "");
  const subtitle = cleanText(section.subtitle || "");
  const role = cleanText(section.role || "");
  const company = cleanText(section.company || "");
  const description = cleanText(section.description || "");
  const text = cleanText(section.text || "");
  const kind = cleanText(section.kind || "section");
  const links = Array.isArray(section.links)
    ? section.links.map((link) => cleanText(link)).filter(Boolean)
    : [];

  if (!title && !role && !company && !description && !text) return null;

  return {
    url,
    kind,
    title,
    subtitle,
    role,
    company,
    description,
    text,
    links,
  };
}

function extractSectionsFromHtml(html, url) {
  const blocks = [];
  const sectionRegex =
    /<(?:section|article|li|div)[^>]*>([\s\S]*?)<\/(?:section|article|li|div)>/gi;
  const seen = new Set();
  let match;

  while ((match = sectionRegex.exec(html))) {
    const block = match[1] || "";
    const titleMatch = block.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);
    const paragraphMatches = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => cleanText(m[1]))
      .filter(Boolean);
    const text = cleanText(block.replace(/<[^>]+>/g, " "));
    const title = cleanText(titleMatch?.[1] || "");
    const description = paragraphMatches.join(" ") || text;
    const normalized = cleanText([title, description].join(" "));
    if (!normalized || normalized.length < 40 || seen.has(normalized)) continue;
    seen.add(normalized);

    const kind = /experience|work|career|intern|developer|engineer/i.test(
      normalized,
    )
      ? "experience"
      : /project|portfolio/i.test(normalized)
        ? "project"
        : /contact|email|phone/i.test(normalized)
          ? "contact"
          : "section";

    const [primary, secondary] = splitSectionTitle(title || description);
    blocks.push({
      url,
      kind,
      title: primary || title,
      subtitle: secondary,
      role: extractRoleFromText(primary, secondary, description, kind),
      company: extractCompanyFromText(primary, secondary, description, kind),
      description,
      text: normalized,
      links: extractLinkLabelsFromBlock(block),
    });
  }

  return blocks.slice(0, 40);
}

function splitSectionTitle(value) {
  const text = cleanText(value || "");
  if (!text) return ["", ""];
  for (const separator of [" — ", " - ", " | ", " / ", " : "]) {
    if (text.includes(separator)) {
      const [first, ...rest] = text.split(separator);
      return [cleanText(first), cleanText(rest.join(separator))];
    }
  }
  return [text, ""];
}

function extractRoleFromText(primary, secondary, description, kind) {
  if (kind !== "experience") return "";
  const candidates = [primary, secondary, description].filter(Boolean);
  for (const candidate of candidates) {
    const match = candidate.match(
      /(?:full stack developer|software engineer|frontend developer|backend developer|developer|engineer|intern)[^,.;\n]*/i,
    );
    if (match) return cleanText(match[0]);
  }
  return cleanText(primary || "");
}

function extractCompanyFromText(primary, secondary, description, kind) {
  if (kind !== "experience") return "";
  const combined = [primary, secondary, description].filter(Boolean).join(" ");
  const patterns = [
    /(?:at|@|for)\s+([A-Z][A-Za-z0-9&.\-() ]{2,80})/i,
    /([A-Z][A-Za-z0-9&.\-() ]{2,80})\s+[—\-|]\s+(?:full stack developer|software engineer|frontend developer|backend developer|developer|engineer|intern)/i,
  ];
  for (const pattern of patterns) {
    const match = combined.match(pattern);
    if (match?.[1]) return cleanText(match[1]);
  }
  return "";
}

function extractLinkLabelsFromBlock(block) {
  const labels = [...block.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => cleanText(match[1]))
    .filter(
      (label) =>
        label &&
        !/^(view resume|download|view|read more|learn more)$/i.test(label),
    );
  return labels.slice(0, 4);
}
