import { createHash } from "node:crypto";
const ACTIONS = new Set(["publish", "engage", "research", "wait", "do_nothing"]);
const ATTRIBUTION_STATUSES = Object.freeze(["UNKNOWN", "VERIFIED", "PARTIAL", "UNOBSERVED"]);
const ATTRIBUTION_STATUS_RANK = Object.freeze({ UNKNOWN: 4, VERIFIED: 3, PARTIAL: 2, UNOBSERVED: 1 });
const METRIC_FIELDS = Object.freeze(["impressions", "reactions", "comments", "shares", "clicks", "leads"]);
const METRIC_COVERAGE = new Set(["measured", "unknown", "unsupported"]);
const MAX_ATTRIBUTIONS = 24;
const MAX_ATTRIBUTION_EVIDENCE = 8;
const MAX_HISTORY = 24;
const METRIC_ASSESSMENTS = Object.freeze(["RESPONSE_OBSERVED", "REACH_WITHOUT_RESPONSE", "MEASURED_NO_RESPONSE", "PARTIAL_MEASUREMENTS", "UNKNOWN_OR_UNSUPPORTED", "UNOBSERVED"]);
function digest(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function safeText(value, max = 160) {
  const text = String(value ?? "").trim();
  if (!text || text.length > max || /(?:password|secret|token|cookie|session|credential|bearer)/i.test(text)) return null;
  return text;
}

function identityFingerprint(value) {
  const text = safeText(value);
  return text ? createHash("sha256").update(text).digest("hex").slice(0, 16) : null;
}

function normalizedFingerprint(value, fingerprint) {
  const candidate = safeText(fingerprint, 16);
  if (candidate && /^[a-f0-9]{16}$/.test(candidate)) return candidate;
  return identityFingerprint(value);
}

function safeTimestamp(value) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function safeNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function safeIds(values, max = MAX_ATTRIBUTION_EVIDENCE) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => safeText(value))
    .filter(Boolean))]
    .sort()
    .slice(0, max);
}

function normalizeAttributionMetrics(metrics) {
  if (!metrics || typeof metrics !== "object") return null;
  const values = Object.fromEntries(METRIC_FIELDS.map((field) => [field, Number.isSafeInteger(metrics.values?.[field]) && metrics.values[field] >= 0 ? metrics.values[field] : null]));
  const coverage = Object.fromEntries(METRIC_FIELDS
    .map((field) => [field, String(metrics.coverage?.[field] || "").toLowerCase()])
    .filter(([, value]) => METRIC_COVERAGE.has(value)));
  const snapshotId = safeText(metrics.snapshotId);
  const capturedAt = safeTimestamp(metrics.capturedAt);
  if (!snapshotId && !capturedAt && !Object.keys(coverage).length && !Object.values(values).some((value) => value !== null)) return null;
  return { snapshotId, capturedAt, values, coverage };
}

function deriveMetricAssessment({ metrics, engagement, conversions, evidence }) {
  const response = (engagement.interactions || 0) > 0 || (engagement.replies || 0) > 0 || (engagement.sentReplies || 0) > 0 || (conversions.count || 0) > 0
    || Boolean(metrics && ["reactions", "comments", "shares", "clicks", "leads"].some((field) => Number.isSafeInteger(metrics.values[field]) && metrics.values[field] > 0));
  const fields = metrics ? Object.keys(metrics.coverage) : [];
  const measured = fields.filter((field) => metrics.coverage[field] === "measured");
  const uncertain = fields.filter((field) => ["unknown", "unsupported"].includes(metrics.coverage[field]));
  const measuredValues = measured.map((field) => metrics.values[field]).filter((value) => Number.isSafeInteger(value));
  let classification = "UNOBSERVED";
  if (response) classification = "RESPONSE_OBSERVED";
  else if (metrics && uncertain.length && measured.length) classification = "PARTIAL_MEASUREMENTS";
  else if (metrics && uncertain.length && !measured.length) classification = "UNKNOWN_OR_UNSUPPORTED";
  else if (measuredValues.some((value) => value > 0) && measured.some((field) => field === "impressions")) classification = "REACH_WITHOUT_RESPONSE";
  else if (measured.length) classification = "MEASURED_NO_RESPONSE";
  const refs = [
    ...(metrics?.snapshotId ? [metrics.snapshotId] : []),
    ...(evidence?.interactionIds || []), ...(evidence?.replyIds || []), ...(evidence?.metricSnapshotIds || []), ...(evidence?.replyIds || [])
  ];
  return { classification, evidenceRefs: safeIds(refs, MAX_ATTRIBUTION_EVIDENCE) };
}

function normalizePostAttribution(row) {
  if (!row || typeof row !== "object") return null;
  const postId = safeText(row.postId);
  const status = String(row.status || "").toUpperCase();
  if (!postId || !ATTRIBUTION_STATUSES.includes(status)) return null;
  const target = row.target && typeof row.target === "object" ? row.target : {};
  const publication = row.publication && typeof row.publication === "object" ? row.publication : {};
  const engagement = row.engagement && typeof row.engagement === "object" ? row.engagement : {};
  const conversions = row.conversions && typeof row.conversions === "object" ? row.conversions : {};
  const evidence = row.evidence && typeof row.evidence === "object" ? row.evidence : {};
  const reasons = [...new Set((Array.isArray(row.reasons) ? row.reasons : [])
    .map((value) => safeText(value, 80))
    .filter((value) => value && /^[a-z0-9:_-]+$/.test(value)))]
    .sort()
    .slice(0, MAX_ATTRIBUTION_EVIDENCE);
  return {
    postId,
    status,
    target: {
      targetId: safeText(target.targetId),
      channel: safeText(target.channel, 80),
      accountFingerprint: normalizedFingerprint(target.accountId, target.accountFingerprint),
      profileFingerprint: normalizedFingerprint(target.profileId, target.profileFingerprint)
    },
    publication: {
      accepted: publication.accepted === true,
      hasPermalink: Boolean(safeText(publication.publicationUrl, 500)),
      verifiedAt: safeTimestamp(publication.verifiedAt)
    },
    metrics: normalizeAttributionMetrics(row.metrics),
    engagement: {
      interactions: safeNonNegativeInteger(engagement.interactions),
      replies: safeNonNegativeInteger(engagement.replies),
      sentReplies: safeNonNegativeInteger(engagement.sentReplies)
    },
    conversions: { count: safeNonNegativeInteger(conversions.count) },
    evidence: {
      receiptIds: safeIds(evidence.receiptIds),
      executionIds: safeIds(evidence.executionIds),
      uncertaintyIds: safeIds(evidence.uncertaintyIds),
      attemptIds: safeIds(evidence.attemptIds),
      metricSnapshotIds: safeIds(evidence.metricSnapshotIds),
      interactionIds: safeIds(evidence.interactionIds),
      replyIds: safeIds(evidence.replyIds)
    },
    reasons,
    metricAssessment: deriveMetricAssessment({ metrics: normalizeAttributionMetrics(row.metrics), engagement: { interactions: safeNonNegativeInteger(engagement.interactions), replies: safeNonNegativeInteger(engagement.replies), sentReplies: safeNonNegativeInteger(engagement.sentReplies) }, conversions: { count: safeNonNegativeInteger(conversions.count) }, evidence })
  };
}

function normalizeMetricAdvisory(rows) {
  const byPost = new Map();
  for (const row of rows) {
    if (!row?.postId || !METRIC_ASSESSMENTS.includes(row.metricAssessment?.classification)) continue;
    byPost.set(row.postId, { postId: row.postId, classification: row.metricAssessment.classification, evidenceRefs: safeIds(row.metricAssessment.evidenceRefs) });
  }
  const all = [...byPost.values()].sort((a, b) => a.postId.localeCompare(b.postId));
  const counts = Object.fromEntries(METRIC_ASSESSMENTS.map((key) => [key, 0]));
  for (const row of all) counts[row.classification] += 1;
  const posts = all.sort((a, b) => METRIC_ASSESSMENTS.indexOf(a.classification) - METRIC_ASSESSMENTS.indexOf(b.classification) || a.postId.localeCompare(b.postId)).slice(0, MAX_ATTRIBUTIONS);
  return { counts, total: all.length, truncated: all.length > posts.length, posts };
}

/**
 * Normalize the existing post-level outcome projection for advisory learning
 * context. Duplicate post rows are reduced by status precedence so UNKNOWN
 * cannot be hidden by a positive row. This is pure and does not grant or
 * change execution authority.
 */
export function normalizePostAttributionContext(outcome = {}) {
  const rows = Array.isArray(outcome?.postAttributions) ? outcome.postAttributions : [];
  const byPost = new Map();
  for (const row of rows) {
    const normalized = normalizePostAttribution(row);
    if (!normalized) continue;
    const prior = byPost.get(normalized.postId);
    if (!prior
      || ATTRIBUTION_STATUS_RANK[normalized.status] > ATTRIBUTION_STATUS_RANK[prior.status]
      || (normalized.status === prior.status && stable(normalized) < stable(prior))) byPost.set(normalized.postId, normalized);
  }
  const allAttributions = [...byPost.values()];
  const counts = Object.fromEntries(ATTRIBUTION_STATUSES.map((status) => [status, 0]));
  for (const attribution of allAttributions) counts[attribution.status] += 1;
  // Retain the highest-risk statuses first so a bounded context cannot hide
  // UNKNOWN behind a lexical post-id cap. Counts/total remain global to the
  // normalized source; callers can distinguish a truncated projection.
  const postAttributions = allAttributions
    .sort((left, right) => ATTRIBUTION_STATUS_RANK[right.status] - ATTRIBUTION_STATUS_RANK[left.status] || left.postId.localeCompare(right.postId))
    .slice(0, MAX_ATTRIBUTIONS);
  return {
    counts,
    total: allAttributions.length,
    truncated: allAttributions.length > postAttributions.length,
    postAttributions,
    metricAdvisory: normalizeMetricAdvisory(allAttributions)
  };
}

export function isNormalizedPostAttributionContext(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.postAttributions) || !value.counts || !Number.isSafeInteger(value.total) || value.total < 0 || value.truncated !== (value.total > value.postAttributions.length)) return false;
  if (value.postAttributions.length > MAX_ATTRIBUTIONS) return false;
  if (!ATTRIBUTION_STATUSES.every((status) => Number.isSafeInteger(value.counts[status]) && value.counts[status] >= 0)) return false;
  if (Object.values(value.counts).reduce((sum, count) => sum + count, 0) !== value.total) return false;
  const normalized = value.postAttributions.map(normalizePostAttribution);
  if (normalized.some((item) => !item) || new Set(normalized.map((item) => item.postId)).size !== normalized.length) return false;
  if (value.counts.UNKNOWN > 0 && !normalized.some((item) => item.status === "UNKNOWN")) return false;
  if (value.metricAdvisory !== undefined) {
    const advisory = value.metricAdvisory;
    if (!advisory || typeof advisory !== "object" || !Array.isArray(advisory.posts) || !advisory.counts || !Number.isSafeInteger(advisory.total) || advisory.total < 0 || advisory.truncated !== (advisory.total > advisory.posts.length)) return false;
    if (!METRIC_ASSESSMENTS.every((key) => Number.isSafeInteger(advisory.counts[key]) && advisory.counts[key] >= 0)) return false;
    if (Object.values(advisory.counts).reduce((sum, count) => sum + count, 0) !== advisory.total || advisory.posts.length > MAX_ATTRIBUTIONS) return false;
    const ids = new Set(normalized.map((item) => item.postId));
    if (advisory.posts.some((item) => !item || !ids.has(item.postId) || !METRIC_ASSESSMENTS.includes(item.classification))) return false;
  }
  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index];
    if (value.counts[current.status] < 1) return false;
    const prior = normalized[index - 1];
    if (prior && (ATTRIBUTION_STATUS_RANK[prior.status] < ATTRIBUTION_STATUS_RANK[current.status]
      || (prior.status === current.status && prior.postId.localeCompare(current.postId) > 0))) return false;
  }
  if (!value.truncated) {
    const retainedCounts = Object.fromEntries(ATTRIBUTION_STATUSES.map((status) => [status, 0]));
    for (const item of normalized) retainedCounts[item.status] += 1;
    if (stable(retainedCounts) !== stable(value.counts) || value.total !== normalized.length) return false;
  } else if (value.total <= normalized.length) return false;
  return true;
}

export function deriveLearningFeedback(state, campaignId, { now = new Date() } = {}) {
  const campaign = (state?.campaigns || []).find((item) => item.id === campaignId);
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  const outcome = campaign.outcomeSummary || null;
  const hour = Math.floor(now.getTime() / 3600000);
  const evidence = [];
  const publication = outcome?.publication || {};
  const metricCoverage = outcome?.metrics?.coverage || {};
  const observation = {
    publication: {
      verified: Number.isSafeInteger(publication.verified) ? publication.verified : 0,
      accepted: Number.isSafeInteger(publication.accepted) ? publication.accepted : 0,
      unknown: Number.isSafeInteger(publication.unknown) ? publication.unknown : 0,
      unverified: Number.isSafeInteger(publication.unverified) ? publication.unverified : 0
    },
    metrics: {
      snapshots: Number.isSafeInteger(outcome?.metrics?.snapshots) ? outcome.metrics.snapshots : 0,
      coverage: Object.fromEntries(Object.entries(metricCoverage).map(([field, counts]) => [field, {
        measured: Number.isSafeInteger(counts?.measured) ? counts.measured : 0,
        unknown: Number.isSafeInteger(counts?.unknown) ? counts.unknown : 0,
        unsupported: Number.isSafeInteger(counts?.unsupported) ? counts.unsupported : 0
      }]))
    }
  };
  let action = "wait";
  const reasons = [];
  if (!outcome) { action = "research"; reasons.push("outcome_summary_missing"); }
  else if ((outcome.publication?.unknown || 0) > 0) { action = "do_nothing"; reasons.push("submission_unknown_quarantined"); evidence.push(...(outcome.publication.unknownExecutionIds || [])); }
  else if ((outcome.metrics?.snapshots || 0) === 0) { action = "research"; reasons.push("metrics_not_collected"); }
  else {
    const totals = outcome.metrics.totals || {};
    const measured = Object.entries(outcome.metrics.coverage || {}).filter(([, c]) => (c.measured || 0) > 0).map(([field]) => field);
    evidence.push(...(outcome.evidence?.metricSnapshotIds || []));
    if ((totals.leads || 0) > 0 || (totals.clicks || 0) > 0) { action = "engage"; reasons.push("measured_response_present"); }
    else if (measured.length > 0) { action = "publish"; reasons.push("measured_outcome_without_response"); }
    else { action = "wait"; reasons.push("metrics_unknown_or_unsupported"); }
  }
  if (!ACTIONS.has(action)) action = "do_nothing";
  const core = { campaignId, hour, action, observation, evidence: evidence.slice(-100), outcomeSummaryId: outcome?.summaryId || null, strategyDecisionId: campaign.strategyDecisions?.at(-1)?.decisionId || null };
  if (Array.isArray(outcome?.postAttributions)) core.postAttributionContext = normalizePostAttributionContext(outcome);
  core.reasons = reasons;
  return { ...core, feedbackId: `learning-${digest(core).slice(0,24)}`, generatedAt: new Date(now).toISOString(), advisory: true, authoritySideEffects: false };
}
export function appendLearningFeedback(campaign, feedback) {
  const prior = Array.isArray(campaign.learningFeedback) ? campaign.learningFeedback : [];
  campaign.learningFeedback = [...prior.filter((item) => item.feedbackId !== feedback.feedbackId), feedback].slice(-MAX_HISTORY);
  campaign.latestLearningFeedback = feedback;
  campaign.learningUpdatedAt = feedback.generatedAt;
  return feedback;
}
