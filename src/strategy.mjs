import { createHash } from "node:crypto";
import { evaluateQueue } from "./guards.mjs";
import { publicationIdentityKeysForPost } from "./campaign-authorization.mjs";

const ACTIONS = new Set(["publish", "engage", "research", "wait", "do_nothing"]);
const MAX_DECISIONS = 24;
const MAX_REASONS = 8;
const MAX_EVIDENCE = 12;
const MAX_TEXT = 180;

function text(value, max = MAX_TEXT) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function digest(value) { return createHash("sha256").update(stable(value)).digest("hex"); }

function evidence(refs = []) {
  return [...new Set(refs.map((item) => text(item, 120)).filter(Boolean))].sort().slice(0, MAX_EVIDENCE);
}

function reasons(values = []) {
  return [...new Set(values.map((item) => text(item, MAX_TEXT)).filter(Boolean))].sort().slice(0, MAX_REASONS);
}

function productReady(campaign) {
  const intelligence = campaign?.productIntelligence;
  const handoff = intelligence?.handoff;
  const document = intelligence?.document;
  const required = ["WHAT_IS_IT", "WHAT_PROBLEM_DOES_IT_SOLVE", "WHY_IS_IT_BETTER", "WHO_NEEDS_IT"];
  return handoff?.readinessStatus === "READY" && required.every((field) => document?.[field]?.text && document[field].evidenceRefs?.length);
}

function unknownForCampaign(state, campaignId, posts = []) {
  const postIds = new Set(posts.map((post) => post.id).filter(Boolean));
  const publicationAttemptIds = new Set(posts.map((post) => post.publicationAttemptId).filter(Boolean));
  const executionIds = new Set();
  for (const request of state.executionRequests || []) {
    if (postIds.has(request.jobId) && request.executionId) executionIds.add(request.executionId);
  }
  for (const receipt of state.executionReceipts || []) {
    if (postIds.has(receipt.jobId) && receipt.executionId) executionIds.add(receipt.executionId);
  }
  for (const lease of state.executionLeases || []) {
    if (postIds.has(lease.jobId) && lease.executionId) executionIds.add(lease.executionId);
  }
  for (const attempt of state.publicationAttempts || []) {
    if (postIds.has(attempt.postId) && attempt.executionId) executionIds.add(attempt.executionId);
  }
  const publicationKeys = new Set(posts.flatMap((post) => [
    post.idempotencyKey,
    ...publicationIdentityKeysForPost(post, state)
  ]).filter(Boolean));
  return (state.submissionUncertainties || []).some((item) => item.status === "UNKNOWN" && (
    item.campaignId === campaignId ||
    postIds.has(item.jobId) ||
    postIds.has(item.postId) ||
    publicationAttemptIds.has(item.publicationAttemptId) ||
    executionIds.has(item.executionId) ||
    (Array.isArray(item.idempotencyKeys) && item.idempotencyKeys.some((key) => publicationKeys.has(key)))
  ));
}

function relevantDiscoveries(campaign) {
  return (campaign?.discovery?.observations || [])
    .filter((item) => item.status === "ELIGIBLE" && item.classification?.label === "RELEVANT")
    // Newer observations carry explicit audience/channel/locale fit evidence.
    // A known mismatch or unknown fit must not become an actionable advisory
    // candidate. Legacy records without fit remain compatible and continue to
    // use the prior policy/relevance gate.
    .filter((item) => !item.fit || item.fit.eligible === true)
    .sort((a, b) => (b.score?.score || 0) - (a.score?.score || 0) || String(a.discoveryId).localeCompare(String(b.discoveryId)));
}

function campaignReplies(state, campaignId) {
  const postIds = new Set((state.posts || []).filter((post) => post.campaignId === campaignId).map((post) => post.id));
  const interactions = new Map((state.interactions || []).filter((item) => postIds.has(item.postId)).map((item) => [item.id, item]));
  return (state.replies || []).filter((reply) => {
    const interaction = interactions.get(reply.interactionId);
    return interaction && ["draft", "approved"].includes(reply.status) && reply.groundingSources?.length && reply.groundingSummary;
  }).sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function dynamicWaitReasons(posts, schedules, now) {
  const reasonsFound = [];
  if (schedules.some((schedule) => schedule.status === "active" && schedule.campaignId === posts[0]?.campaignId)) reasonsFound.push("active_schedule");
  for (const post of posts) {
    const scheduled = Date.parse(post.scheduledAt || "");
    if (Number.isFinite(scheduled) && scheduled > now.getTime()) reasonsFound.push("scheduled_time_not_due");
    for (const reason of post.authorizationDecision?.reasons || []) {
      if (["minimum_interval_not_met", "campaign_minimum_interval_not_met", "daily_limit_reached", "campaign_daily_limit_reached", "account_daily_limit_reached", "campaign_concurrency_limit_reached"].includes(reason)) reasonsFound.push(reason);
    }
  }
  return [...new Set(reasonsFound)].sort();
}

/** Deterministic advisory strategy. It reads state and never creates execution authority. */
export function deriveStrategyDecision(state, campaignId, { now = new Date() } = {}) {
  const campaign = (state.campaigns || []).find((item) => item.id === campaignId);
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  const posts = (state.posts || []).filter((post) => post.campaignId === campaignId).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const discoveries = relevantDiscoveries(campaign);
  const base = { campaignId, timestampBucket: Math.floor(now.getTime() / (15 * 60 * 1000)) };
  let action = "do_nothing";
  let score = 0;
  let eligible = false;
  let candidateId = null;
  let reasonList = [];
  let refs = [];
  if (!productReady(campaign)) {
    reasonList = ["product_intelligence_incomplete"];
  } else if (unknownForCampaign(state, campaignId, posts)) {
    reasonList = ["submission_unknown_quarantined"];
  } else {
    const publishable = [];
    for (const post of posts) {
      if (!["draft", "approved", "queued", "blocked"].includes(post.status) || !post.content?.trim()) continue;
      const target = (state.targets || []).find((item) => item.id === post.targetId);
      if (!target || target.status !== "active") continue;
      const decision = evaluateQueue(post, state, now, { mode: "dry_run" });
      if (decision.allowed) publishable.push({ post, decision });
    }
    if (publishable.length) {
      const selected = publishable[0];
      action = "publish"; score = 100; eligible = true; candidateId = selected.post.id;
      reasonList = ["product_intelligence_ready", "target_policy_and_queue_checks_pass"];
      refs = [`post:${selected.post.id}`, `target:${selected.post.targetId}`];
    } else if (discoveries.length) {
      const reply = campaignReplies(state, campaignId);
      const discovery = discoveries[0];
      if (reply.length) {
        action = "engage"; score = 75; eligible = true; candidateId = reply[0].id;
        reasonList = ["relevant_discovery", "grounded_reply_opportunity"];
        refs = [`discovery:${discovery.discoveryId}`, `reply:${reply[0].id}`];
      } else {
        action = "research"; score = 50; eligible = true; candidateId = discovery.discoveryId;
        reasonList = ["relevant_discovery", "no_grounded_action_draft"];
        refs = [`discovery:${discovery.discoveryId}`];
      }
    } else {
      const waiting = dynamicWaitReasons(posts, state.schedules || [], now);
      if (waiting.length) { action = "wait"; score = 20; eligible = false; reasonList = waiting; }
      else reasonList = ["no_safe_action_candidate"];
    }
  }
  const core = { ...base, action, score, eligible, candidateId, reasons: reasons(reasonList), evidence: evidence(refs) };
  return { ...core, decisionId: `strategy-${digest(core).slice(0, 24)}`, createdAt: now.toISOString(), advisory: true, authoritySideEffects: false };
}

export function appendStrategyDecision(campaign, decision) {
  const prior = Array.isArray(campaign.strategyDecisions) ? campaign.strategyDecisions : [];
  const withoutDuplicate = prior.filter((item) => item.decisionId !== decision.decisionId);
  campaign.strategyDecisions = [...withoutDuplicate, decision].slice(-MAX_DECISIONS);
  campaign.strategyUpdatedAt = decision.createdAt;
  return decision;
}

export { MAX_DECISIONS };
