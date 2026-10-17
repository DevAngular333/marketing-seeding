import { createHash } from "node:crypto";
const ACTIONS = new Set(["publish", "engage", "research", "wait", "do_nothing"]);
const MAX_HISTORY = 24;
function digest(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
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
  const core = { campaignId, hour, action, observation, reasons, evidence: evidence.slice(-100), outcomeSummaryId: outcome?.summaryId || null, strategyDecisionId: campaign.strategyDecisions?.at(-1)?.decisionId || null };
  return { ...core, feedbackId: `learning-${digest(core).slice(0,24)}`, generatedAt: new Date(now).toISOString(), advisory: true, authoritySideEffects: false };
}
export function appendLearningFeedback(campaign, feedback) {
  const prior = Array.isArray(campaign.learningFeedback) ? campaign.learningFeedback : [];
  campaign.learningFeedback = [...prior.filter((item) => item.feedbackId !== feedback.feedbackId), feedback].slice(-MAX_HISTORY);
  campaign.latestLearningFeedback = feedback;
  campaign.learningUpdatedAt = feedback.generatedAt;
  return feedback;
}
