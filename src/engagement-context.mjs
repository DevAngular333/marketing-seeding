import { createHash } from "node:crypto";
import { CHANNELS } from "./constants.mjs";
import { unresolvedSubmission, UNKNOWN_POST_STATUS } from "./submission-uncertainty.mjs";

const MAX_TEXT = 240;
const MAX_CONVERSATIONS = 48;
const MAX_CANDIDATES = 24;
const REASONS = Object.freeze({
  OPEN_GROUNDED_REPLY: "OPEN_GROUNDED_REPLY",
  ALREADY_REPLIED: "ALREADY_REPLIED",
  MISSING_EXTERNAL_ID: "MISSING_EXTERNAL_ID",
  MISSING_GROUNDING: "MISSING_GROUNDING",
  UNKNOWN_POST_QUARANTINED: "UNKNOWN_POST_QUARANTINED",
  UNSUPPORTED_CHANNEL: "UNSUPPORTED_CHANNEL",
  STALE_OR_MISSING_READINESS: "STALE_OR_MISSING_READINESS",
  NO_REPLY_DRAFT: "NO_REPLY_DRAFT",
  REPLY_PENDING_APPROVAL: "REPLY_PENDING_APPROVAL",
  ORPHANED_POST: "ORPHANED_POST"
});

function text(value, max = MAX_TEXT) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function fingerprint(value) {
  const raw = String(value ?? "").trim();
  return raw ? createHash("sha256").update(raw).digest("hex").slice(0, 16) : null;
}

function dateValue(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function readinessReason(target, now) {
  const readiness = target?.readiness;
  if (!readiness || String(readiness.state || "").toLowerCase() !== "ready") return REASONS.STALE_OR_MISSING_READINESS;
  const expiresAt = Date.parse(String(readiness.expiresAt || ""));
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) return REASONS.STALE_OR_MISSING_READINESS;
  return null;
}

function replyGrounded(reply) {
  return Array.isArray(reply?.groundingSources) && reply.groundingSources.length > 0 && Boolean(text(reply?.groundingSummary));
}

function sortRows(rows) {
  return rows.sort((a, b) => dateValue(b.capturedAt) - dateValue(a.capturedAt) || String(a.conversationRef).localeCompare(String(b.conversationRef)));
}

/**
 * Read-only, bounded conversation context for Mission Control and advisory strategy.
 * It never creates authority, changes reply state, calls a provider, or selects an account.
 */
export function projectEngagementContext(state = {}, { campaignId = null, now = new Date(), maxConversations = MAX_CONVERSATIONS, maxCandidates = MAX_CANDIDATES } = {}) {
  const source = state && typeof state === "object" ? state : {};
  const posts = Array.isArray(source.posts) ? source.posts : [];
  const targets = Array.isArray(source.targets) ? source.targets : [];
  const interactions = Array.isArray(source.interactions) ? source.interactions : [];
  const replies = Array.isArray(source.replies) ? source.replies : [];
  const postById = new Map(posts.map((post) => [post.id, post]));
  const targetById = new Map(targets.map((target) => [target.id, target]));
  const repliesByInteraction = new Map();
  for (const reply of replies) {
    if (!reply || typeof reply !== "object" || !reply.interactionId) continue;
    const rows = repliesByInteraction.get(reply.interactionId) || [];
    rows.push(reply);
    repliesByInteraction.set(reply.interactionId, rows);
  }
  const rows = [];
  const candidates = [];
  const orderedInteractions = [...interactions].sort((a, b) => dateValue(b.capturedAt) - dateValue(a.capturedAt) || String(a.id).localeCompare(String(b.id)));
  for (const interaction of orderedInteractions) {
    if (!interaction || typeof interaction !== "object") continue;
    const post = postById.get(interaction.postId);
    if (!post || (campaignId && post.campaignId !== campaignId)) continue;
    const target = targetById.get(post.targetId);
    const interactionReplies = [...(repliesByInteraction.get(interaction.id) || [])].sort((a, b) => dateValue(a.createdAt) - dateValue(b.createdAt) || String(a.id).localeCompare(String(b.id)));
    const reasons = [];
    const unknown = post.status === UNKNOWN_POST_STATUS || Boolean(unresolvedSubmission(source, post));
    const policy = target ? CHANNELS[target.channel] : null;
    if (!target || !policy) reasons.push(REASONS.UNSUPPORTED_CHANNEL);
    const readiness = readinessReason(target, now);
    if (readiness) reasons.push(readiness);
    if (!interaction.externalId) reasons.push(REASONS.MISSING_EXTERNAL_ID);
    if (unknown) reasons.push(REASONS.UNKNOWN_POST_QUARANTINED);
    const sent = interactionReplies.find((reply) => reply.status === "sent");
    const grounded = interactionReplies.filter(replyGrounded);
    if (sent) reasons.push(REASONS.ALREADY_REPLIED);
    else if (grounded.length) reasons.push(REASONS.OPEN_GROUNDED_REPLY);
    else if (interactionReplies.length) reasons.push(REASONS.MISSING_GROUNDING);
    else reasons.push(REASONS.NO_REPLY_DRAFT);
    const blocked = reasons.some((reason) => [REASONS.UNSUPPORTED_CHANNEL, REASONS.STALE_OR_MISSING_READINESS, REASONS.MISSING_EXTERNAL_ID, REASONS.UNKNOWN_POST_QUARANTINED, REASONS.ALREADY_REPLIED].includes(reason));
    const selectedReply = grounded[0] || interactionReplies[0] || null;
    const approvalRequired = selectedReply?.status === "draft" && policy?.replyRequiresApproval !== false;
    if (approvalRequired) reasons.push(REASONS.REPLY_PENDING_APPROVAL);
    // A grounded draft remains advisory context while approval is required.
    // It must never be reported as an actionable candidate because that would
    // make the read model appear to authorize an external reply.
    const eligible = Boolean(grounded.length && !blocked && !approvalRequired && selectedReply && ["draft", "approved"].includes(selectedReply.status));
    if (eligible) {
      const candidate = {
        candidateRef: fingerprint(`${interaction.id}:${selectedReply.id}`),
        conversationRef: fingerprint(interaction.externalId || interaction.id),
        interactionRef: fingerprint(interaction.id),
        replyRef: fingerprint(selectedReply.id),
        campaignRef: fingerprint(post.campaignId),
        targetRef: fingerprint(post.targetId),
        channel: target.channel,
        status: "ACTIONABLE",
        reasonCodes: [REASONS.OPEN_GROUNDED_REPLY, ...(selectedReply.status === "draft" && policy.replyRequiresApproval !== false ? [REASONS.REPLY_PENDING_APPROVAL] : [])]
      };
      candidates.push(candidate);
    }
    rows.push({
      conversationRef: fingerprint(interaction.externalId || interaction.id),
      interactionRef: fingerprint(interaction.id),
      campaignRef: fingerprint(post.campaignId),
      postRef: fingerprint(post.id),
      targetRef: fingerprint(post.targetId),
      channel: target?.channel || null,
      externalIdPresent: Boolean(interaction.externalId),
      authorLabel: text(interaction.authorLabel, 100) || "unknown",
      text: text(interaction.text),
      capturedAt: interaction.capturedAt || null,
      replyCount: interactionReplies.length,
      sentReply: Boolean(sent),
      status: unknown ? "QUARANTINED" : eligible ? "ACTIONABLE" : "OBSERVED",
      reasonCodes: [...new Set(reasons)].sort(),
      latestReplyAt: interactionReplies.map((reply) => reply.createdAt).filter(Boolean).sort().at(-1) || null
    });
  }
  sortRows(rows);
  candidates.sort((a, b) => String(a.candidateRef).localeCompare(String(b.candidateRef)));
  return {
    schemaVersion: 1,
    campaignRef: campaignId ? fingerprint(campaignId) : null,
    generatedAt: now.toISOString(),
    total: rows.length,
    truncated: rows.length > maxConversations,
    conversations: rows.slice(0, maxConversations),
    candidateTotal: candidates.length,
    candidates: candidates.slice(0, maxCandidates),
    candidateTruncated: candidates.length > maxCandidates,
    authoritySideEffects: false,
    externalSideEffects: false
  };
}

export { REASONS as ENGAGEMENT_CONTEXT_REASONS };
