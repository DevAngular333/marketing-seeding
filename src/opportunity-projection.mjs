/**
 * Read-only, bounded opportunity projection for Mission Control.
 *
 * This module explains why an already-normalized discovery is or is not a
 * distribution opportunity. It never creates execution authority, mutates
 * state, or calls a provider.
 */
const MAX_OPPORTUNITIES = 24;
const MAX_REASON_LENGTH = 160;
const ALLOWED_ACTIONS = new Set(["research", "engage"]);
const FIT_STATUSES = new Set(["MATCHED", "MISMATCHED", "UNKNOWN"]);

function text(value, max = MAX_REASON_LENGTH) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function safeId(value) {
  const id = text(value, 160);
  return /^[A-Za-z0-9._:-]{1,160}$/.test(id) ? id : null;
}

function scopeKey(campaignId, discoveryId) {
  return `${campaignId || ""}\u0000${discoveryId}`;
}

function scoreOf(item) {
  const score = Number(item?.score?.score);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
}

function fitIsProven(item) {
  // Legacy observations without fit remain compatible with the existing
  // discovery contract, while an explicit fit must be fully matched.
  if (!item?.fit) return true;
  if (item.fit.eligible !== true) return false;
  return [item.fit.audience, item.fit.channel, item.fit.locale]
    .every((dimension) => String(dimension?.status || "").toUpperCase() === "MATCHED");
}

function fitSummary(fit) {
  if (!fit || typeof fit !== "object" || Array.isArray(fit)) return null;
  const summarize = (value) => {
    const status = FIT_STATUSES.has(String(value?.status || "").toUpperCase()) ? String(value.status).toUpperCase() : "UNKNOWN";
    const reason = text(value?.reason, 120) || "no fit evidence";
    return { status, reason };
  };
  return {
    audience: summarize(fit.audience),
    channel: summarize(fit.channel),
    locale: summarize(fit.locale),
    eligible: fit.eligible === true
  };
}

function candidate(item) {
  const id = safeId(item?.discoveryId);
  const campaignId = item?.campaignId == null ? null : safeId(item.campaignId);
  if (item?.campaignId != null && !campaignId) return null;
  if (!id || item?.status !== "ELIGIBLE" || item?.classification?.label !== "RELEVANT" || !fitIsProven(item)) return null;
  const score = scoreOf(item);
  const reasons = ["channel_policy_eligible", "relevance_evidence_present"];
  const matched = Array.isArray(item.classification?.matchedKeywords) ? item.classification.matchedKeywords : [];
  if (matched.length) reasons.push(`matched_keywords:${matched.slice(0, 4).map((value) => text(value, 48)).join(",")}`);
  if (item.fit) reasons.push("audience_channel_fit_matched");
  const action = ALLOWED_ACTIONS.has(item.recommendedAction) ? item.recommendedAction : "research";
  const summary = fitSummary(item.fit);
  return {
    campaignId,
    discoveryId: id,
    channel: text(item.channel, 80) || null,
    score,
    recommendedAction: action,
    reasons: [...new Set(reasons)].slice(0, 8),
    evidence: [`discovery:${id}`, ...(item.provenance?.source ? [`source:${text(item.provenance.source, 80)}`] : [])],
    ...(summary ? { fit: summary } : {}),
    advisory: true,
    authoritySideEffects: false,
    externalSideEffects: false
  };
}

/**
 * Project deterministic, actionable discovery opportunities without changing
 * campaign state. Ineligible, blocked, unknown-fit, malformed, and duplicate
 * rows are omitted (fail closed).
 */
export function projectDiscoveryOpportunities(discoveries = [], { limit = MAX_OPPORTUNITIES } = {}) {
  const boundedLimit = Number.isInteger(limit) ? Math.max(0, Math.min(MAX_OPPORTUNITIES, limit)) : MAX_OPPORTUNITIES;
  const seen = new Set();
  return (Array.isArray(discoveries) ? discoveries : [])
    .map(candidate)
    .filter(Boolean)
    .filter((item) => {
      const key = scopeKey(item.campaignId, item.discoveryId);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.score - a.score || a.discoveryId.localeCompare(b.discoveryId) || String(a.campaignId || "").localeCompare(String(b.campaignId || "")))
    .slice(0, boundedLimit);
}

export { MAX_OPPORTUNITIES };
