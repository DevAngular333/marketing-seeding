import { createHash } from "node:crypto";
import { projectEngagementContext } from "./engagement-context.mjs";
import { unresolvedSubmission, UNKNOWN_POST_STATUS } from "./submission-uncertainty.mjs";

const MAX_CONVERSATIONS = 48;
const MAX_TURNS = 32;
const SECRET_RE = /(?:password|passphrase|secret|token|cookie|credential|api[_-]?key|session(?:[_ -]?token)?|bearer)\s*[:=]\s*[^\s,;]+/gi;

function fingerprint(value) {
  const raw = String(value ?? "").trim();
  return raw ? createHash("sha256").update(raw).digest("hex").slice(0, 16) : null;
}

function time(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeText(value, max = 240) {
  return String(value ?? "").replace(SECRET_RE, "$1=[REDACTED]").replace(/\s+/g, " ").trim().slice(0, max);
}

function bound(value, fallback, maximum) {
  return Number.isSafeInteger(value) ? Math.max(0, Math.min(maximum, value)) : fallback;
}

/**
 * Read-only continuity projection for existing interactions and replies.
 * It provides bounded chronological turns for Mission Control/advisory use.
 * It never creates authority, changes reply state, calls a provider, or
 * merges interactions across posts.
 */
export function projectConversationContinuity(state = {}, { campaignId = null, now = new Date(), maxConversations = MAX_CONVERSATIONS, maxTurns = MAX_TURNS } = {}) {
  const observedAt = now instanceof Date ? new Date(now.getTime()) : new Date(now);
  if (!Number.isFinite(observedAt.getTime())) throw new Error("conversation continuity now must be a valid date");
  const source = state && typeof state === "object" ? state : {};
  const posts = Array.isArray(source.posts) ? source.posts : [];
  const interactions = Array.isArray(source.interactions) ? source.interactions : [];
  const replies = Array.isArray(source.replies) ? source.replies : [];
  const conversationLimit = bound(maxConversations, MAX_CONVERSATIONS, MAX_CONVERSATIONS);
  const turnLimit = bound(maxTurns, MAX_TURNS, MAX_TURNS);
  const postById = new Map(posts.map((post) => [post.id, post]));
  const repliesByInteraction = new Map();
  for (const reply of replies) {
    if (!reply || typeof reply !== "object" || !reply.interactionId) continue;
    const rows = repliesByInteraction.get(reply.interactionId) || [];
    rows.push(reply);
    repliesByInteraction.set(reply.interactionId, rows);
  }
  const groups = new Map();
  for (const interaction of interactions) {
    if (!interaction || typeof interaction !== "object" || !interaction.id) continue;
    const post = postById.get(interaction.postId);
    if (!post || (campaignId && post.campaignId !== campaignId)) continue;
    // Scope by post so an external identifier reused on another post cannot
    // contaminate continuity history.
    const key = `${String(post.id)}:${String(interaction.externalId || interaction.id)}`;
    const group = groups.get(key) || { key, post, interactions: [] };
    group.interactions.push(interaction);
    groups.set(key, group);
  }
  const context = projectEngagementContext(source, { campaignId, now: observedAt, maxConversations, maxCandidates: 0 });
  const contextByInteraction = new Map((context.conversations || []).map((row) => [row.interactionRef, row]));
  const conversations = [];
  for (const group of groups.values()) {
    const turns = [];
    let quarantined = false;
    let latest = 0;
    for (const interaction of group.interactions) {
      const interactionRef = fingerprint(interaction.id);
      const row = contextByInteraction.get(interactionRef);
      const unknown = group.post.status === UNKNOWN_POST_STATUS || Boolean(unresolvedSubmission(source, group.post));
      quarantined ||= unknown;
      const capturedAt = interaction.capturedAt || null;
      latest = Math.max(latest, time(capturedAt));
      turns.push({ turnRef: fingerprint(`interaction:${interaction.id}`), kind: "interaction", interactionRef, capturedAt, authorLabel: safeText(interaction.authorLabel, 100) || "unknown", text: safeText(interaction.text), status: unknown ? "QUARANTINED" : "OBSERVED" });
      for (const reply of [...(repliesByInteraction.get(interaction.id) || [])].sort((a, b) => time(a.createdAt) - time(b.createdAt) || String(a.id).localeCompare(String(b.id)))) {
        const createdAt = reply.createdAt || null;
        latest = Math.max(latest, time(createdAt));
        turns.push({ turnRef: fingerprint(`reply:${reply.id}`), kind: "reply", replyRef: fingerprint(reply.id), interactionRef, createdAt, text: safeText(reply.text), status: String(reply.status || "unknown").toUpperCase() });
      }
      if (row?.status === "QUARANTINED") quarantined = true;
    }
    turns.sort((a, b) => time(a.capturedAt || a.createdAt) - time(b.capturedAt || b.createdAt) || String(a.turnRef).localeCompare(String(b.turnRef)));
    const boundedTurns = turnLimit === 0 ? [] : turns.slice(-turnLimit);
    conversations.push({
      conversationRef: fingerprint(group.key),
      campaignRef: fingerprint(group.post.campaignId),
      postRef: fingerprint(group.post.id),
      externalIdPresent: group.interactions.some((item) => Boolean(item.externalId)),
      turnCount: turns.length,
      truncated: turns.length > turnLimit,
      latestActivityAt: latest ? new Date(latest).toISOString() : null,
      status: quarantined ? "QUARANTINED" : "OBSERVED",
      turns: boundedTurns
    });
  }
  conversations.sort((a, b) => time(b.latestActivityAt) - time(a.latestActivityAt) || String(a.conversationRef).localeCompare(String(b.conversationRef)));
  return {
    schemaVersion: 1,
    generatedAt: observedAt.toISOString(),
    campaignRef: campaignId ? fingerprint(campaignId) : null,
    total: conversations.length,
    truncated: conversations.length > conversationLimit,
    conversations: conversations.slice(0, conversationLimit),
    authoritySideEffects: false,
    externalSideEffects: false
  };
}
