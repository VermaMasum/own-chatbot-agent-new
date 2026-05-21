import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function listBots() {
  const bots = await prisma.bot.findMany({ orderBy: { createdAt: "desc" } });
  return bots;
}

export async function getBot(botId) {
  if (!botId) return null;
  return prisma.bot.findUnique({ where: { id: botId } }) || null;
}

export async function saveBot(profile, botId) {
  if (!profile || typeof profile !== "object") {
    throw new Error("A chatbot profile is required");
  }
  const { randomUUID } = await import("node:crypto");
  const id = typeof botId === "string" && botId.trim() ? botId.trim() : randomUUID();
  const sanitized = { ...profile, botId: id, publishUrl: profile.publishUrl || "", embedUrl: profile.embedUrl || "" };

  return prisma.bot.upsert({
    where:  { id },
    update: { profile: sanitized, status: "published", updatedAt: new Date() },
    create: { id, profile: sanitized, status: "published", source: "local-db" },
  });
}

export async function createUser({ name, email, passwordHash }) {
  const normalizedEmail = String(email || "").toLowerCase().trim();
  try {
    return await prisma.user.create({
      data: {
        name: String(name || "").trim(),
        email: normalizedEmail,
        passwordHash,
      },
    });
  } catch (err) {
    if (err.code === "P2002") throw new Error("Email already registered");
    throw err;
  }
}

export async function findUserByEmail(email) {
  return prisma.user.findUnique({
    where: { email: String(email || "").toLowerCase().trim() },
  }) || null;
}

export async function findUserById(id) {
  return prisma.user.findUnique({ where: { id } }) || null;
}

export async function saveCrawlRun(payload) {
  return prisma.crawlRun.create({
    data: {
      websiteUrl: String(payload?.websiteUrl || ""),
      title:      String(payload?.title      || ""),
      summary:    String(payload?.summary    || ""),
      pages:      Array.isArray(payload?.pages)    ? payload.pages    : [],
      sections:   Array.isArray(payload?.sections) ? payload.sections : [],
      chunks:     Array.isArray(payload?.chunks)   ? payload.chunks   : [],
      topics:     Array.isArray(payload?.topics)   ? payload.topics   : [],
      source:     String(payload?.source || "crawl"),
    },
  });
}

export async function saveChatExchange(payload) {
  return prisma.message.create({
    data: {
      botId:          String(payload?.botId          || "").trim(),
      sessionId:      String(payload?.sessionId      || "").trim(),
      userMessage:    String(payload?.userMessage    || "").trim(),
      assistantReply: String(payload?.assistantReply || "").trim(),
      provider:       String(payload?.provider       || "").trim(),
      metadata: (payload?.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata))
        ? payload.metadata
        : {},
    },
  });
}
