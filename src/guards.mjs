import { CHANNELS, TRANSITIONS } from "./constants.mjs";
import { createHash } from "node:crypto";

const ACTIVE_PUBLICATION_STATUSES = new Set(["queued", "publishing", "processing", "published"]);

export function normalizeContent(value = "") {
  return value.toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

export function assertTransition(from, to) {
  if (!TRANSITIONS[from]?.includes(to)) {
    throw new Error(`Invalid post transition: ${from} -> ${to}`);
  }
}

export function approvalFingerprint(post, target) {
  return createHash("sha256").update(JSON.stringify({
    postId: post.id,
    content: post.content,
    assetPath: post.assetPath || null,
    targetId: target.id,
    channel: target.channel,
    url: target.url,
    rulesStatus: target.rulesStatus,
    consentBasis: target.consentBasis || null,
    audienceSource: target.audienceSource || null,
    unsubscribeMechanism: target.unsubscribeMechanism || null,
    readiness: target.readiness || null
  })).digest("hex");
}

export function evaluateQueue(post, state, now = new Date()) {
  const target = state.targets.find((item) => item.id === post.targetId);
  if (!target) return { allowed: false, reasons: ["target_missing"] };
  const policy = CHANNELS[target.channel];
  if (!policy) return { allowed: false, reasons: ["channel_policy_missing"] };

  const reasons = [];
  if (!post.approvedAt) reasons.push("human_approval_required");
  if (post.approvedAt && post.approvalBinding !== approvalFingerprint(post, target)) reasons.push("approval_binding_stale");
  if (!post.content?.trim()) reasons.push("content_missing");
  if (policy.maxContentChars && post.content?.length > policy.maxContentChars) reasons.push("content_too_long");
  if (policy.requiresRulesReview && target.rulesStatus !== "reviewed") {
    reasons.push("target_rules_not_reviewed");
  }
  if (policy.requiresConsent && (!target.consentBasis || !target.audienceSource || !target.unsubscribeMechanism)) {
    reasons.push("consent_metadata_required");
  }
  if (target.status !== "active") reasons.push("target_not_active");
  if (target.readiness && target.readiness.state !== "ready") reasons.push("target_not_ready");

  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const accountPosts = state.posts.filter((item) => {
    if (item.id === post.id || !ACTIVE_PUBLICATION_STATUSES.has(item.status)) return false;
    const itemTarget = state.targets.find((targetItem) => targetItem.id === item.targetId);
    if (!itemTarget || itemTarget.accountId !== target.accountId) return false;
    const timestamp = item.publishedAt || item.processingAt || item.publishingAt || item.queuedAt;
    return timestamp && new Date(timestamp) >= dayStart;
  });
  if (accountPosts.length >= policy.dailyLimitPerAccount) reasons.push("daily_limit_reached");

  const recent = state.posts
    .filter((item) => item.id !== post.id && ACTIVE_PUBLICATION_STATUSES.has(item.status))
    .map((item) => ({
      item,
      target: state.targets.find((targetItem) => targetItem.id === item.targetId),
      at: item.publishedAt || item.processingAt || item.publishingAt || item.queuedAt
    }))
    .filter((entry) => entry.target?.accountId === target.accountId && entry.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))[0];
  if (recent) {
    const elapsedMinutes = (now - new Date(recent.at)) / 60000;
    if (elapsedMinutes < policy.minimumIntervalMinutes) reasons.push("minimum_interval_not_met");
  }

  const normalized = normalizeContent(post.content);
  const duplicate = state.posts.some((item) => {
    if (item.id === post.id || item.status !== "published") return false;
    const ageDays = (now - new Date(item.publishedAt)) / 86400000;
    return ageDays <= 7 && normalizeContent(item.content) === normalized;
  });
  if (duplicate) reasons.push("duplicate_content_within_7_days");

  return { allowed: reasons.length === 0, reasons, policy, target };
}

export function assertReplyCanSend(reply, state) {
  const interaction = state.interactions.find((item) => item.id === reply.interactionId);
  if (!interaction) throw new Error("Reply interaction is missing");
  const post = state.posts.find((item) => item.id === interaction.postId);
  const target = state.targets.find((item) => item.id === post?.targetId);
  const policy = CHANNELS[target?.channel];
  if (reply.status !== "approved") {
    throw new Error(`Reply cannot be sent from ${reply.status}`);
  }
  if (!reply.approvedAt && policy?.replyRequiresApproval !== false) {
    throw new Error("Reply requires human approval");
  }
}
