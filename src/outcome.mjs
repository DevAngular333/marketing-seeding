import { createHash } from "node:crypto";

const METRIC_FIELDS = Object.freeze(["impressions", "reactions", "comments", "shares", "clicks", "leads"]);
const MAX_HISTORY = 24;
const MAX_ITEMS = 100;

function digest(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function bounded(items) { return (Array.isArray(items) ? items : []).slice(-MAX_ITEMS); }
function latestBy(items, key) {
  const map = new Map();
  for (const item of bounded(items)) {
    const id = item?.[key]; if (!id) continue;
    const prior = map.get(id);
    if (!prior || String(item.capturedAt || item.createdAt || item.occurredAt || "") > String(prior.capturedAt || prior.createdAt || prior.occurredAt || "")) map.set(id, item);
  }
  return map;
}

export function deriveOutcomeSummary(state, campaignId, { now = new Date() } = {}) {
  const campaign = (state?.campaigns || []).find((item) => item.id === campaignId);
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  const posts = (state.posts || []).filter((post) => post.campaignId === campaignId);
  const postIds = new Set(posts.map((post) => post.id));
  const receipts = (state.executionReceipts || []).filter((receipt) => postIds.has(receipt.postId || receipt.jobId));
  const uncertainties = (state.submissionUncertainties || []).filter((item) => postIds.has(item.jobId || item.postId));
  const statuses = {};
  for (const post of posts) statuses[post.status || "unknown"] = (statuses[post.status || "unknown"] || 0) + 1;
  const verifiedPosts = posts.filter((post) => post.status === "published" && post.publicationUrl && (post.publicationVerification || post.verificationEvidence || receipts.some((row) => { const receipt = row.receipt || row; const evidence = receipt.publicationEvidence || receipt.publicationVerification || {}; return (row.postId || row.jobId || receipt.jobId) === post.id && (receipt.submitState === "CONFIRMED" || evidence.state === "VERIFIED" || evidence.verificationState === "VERIFIED" || receipt.verificationState === "VERIFIED"); })));
  const accepted = receipts.filter((r) => r.acceptanceEvidence || r.submitAcceptanceEvidence || r.submissionAccepted === true).length;
  const unknown = uncertainties.filter((item) => String(item.status).toUpperCase() === "UNKNOWN").length;
  const publication = {
    totalPosts: posts.length,
    statusCounts: statuses,
    verified: verifiedPosts.length,
    accepted,
    unknown,
    unverified: Math.max(0, posts.length - verifiedPosts.length),
    verifiedPostIds: verifiedPosts.map((post) => post.id).slice(-MAX_ITEMS),
    unknownExecutionIds: uncertainties.filter((item) => String(item.status).toUpperCase() === "UNKNOWN").map((item) => item.executionId || item.id).filter(Boolean).slice(-MAX_ITEMS)
  };
  const metrics = (state.metricSnapshots || []).filter((item) => postIds.has(item.postId));
  const latestMetrics = latestBy(metrics, "postId");
  const coverage = Object.fromEntries(METRIC_FIELDS.map((field) => [field, { measured: 0, unknown: 0, unsupported: 0 }]));
  const totals = {};
  for (const field of METRIC_FIELDS) totals[field] = null;
  for (const snapshot of latestMetrics.values()) for (const field of METRIC_FIELDS) {
    const status = snapshot.coverage?.[field] || (Number.isSafeInteger(snapshot[field]) ? "measured" : "unknown");
    coverage[field][status] = (coverage[field][status] || 0) + 1;
    if (status === "measured" && Number.isSafeInteger(snapshot[field])) totals[field] = (totals[field] || 0) + snapshot[field];
  }
  const interactions = (state.interactions || []).filter((item) => postIds.has(item.postId));
  const replies = (state.replies || []).filter((item) => interactions.some((interaction) => interaction.id === item.interactionId));
  const conversions = (state.conversions || []).filter((item) => item.campaignId === campaignId || postIds.has(item.postId));
  const keywords = (state.keywordSnapshots || []).filter((item) => item.campaignId === campaignId).slice(-MAX_ITEMS).map((item) => ({ keyword: item.keyword || null, capturedAt: item.capturedAt || null, coverage: item.coverage || null, values: Object.fromEntries(METRIC_FIELDS.map((field) => [field, Number.isSafeInteger(item[field]) ? item[field] : null])) }));
  const summary = {
    schemaVersion: 1, campaignId, generatedAt: new Date(now).toISOString(),
    publication, metrics: { snapshots: latestMetrics.size, totals, coverage },
    engagement: { interactions: interactions.length, openInteractions: interactions.filter((item) => item.status === "open").length, replies: replies.length, sentReplies: replies.filter((item) => item.status === "sent").length, conversions: conversions.length },
    keywords,
    evidence: { postIds: posts.map((post) => post.id).slice(-MAX_ITEMS), receiptIds: receipts.map((r) => r.id).filter(Boolean).slice(-MAX_ITEMS), metricSnapshotIds: [...latestMetrics.values()].map((m) => m.id).filter(Boolean).slice(-MAX_ITEMS) }
  };
  summary.summaryId = `outcome-${digest({ ...summary, generatedAt: new Date(now).toISOString().slice(0, 13) }).slice(0, 24)}`;
  return summary;
}

export function appendOutcomeSummary(campaign, summary) {
  const prior = Array.isArray(campaign.outcomeSummaries) ? campaign.outcomeSummaries : [];
  campaign.outcomeSummaries = [...prior.filter((item) => item.summaryId !== summary.summaryId), summary].slice(-MAX_HISTORY);
  campaign.outcomeSummary = summary;
  campaign.outcomeUpdatedAt = summary.generatedAt;
  return summary;
}
