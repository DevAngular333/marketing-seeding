import { createHash, randomUUID } from "node:crypto";
import { publicationIdentityKeysForPost } from "./campaign-authorization.mjs";

export const UNKNOWN_POST_STATUS = "submit_result_unknown";

export function publicationKeys(post, state) {
  return [...new Set([post.idempotencyKey, ...publicationIdentityKeysForPost(post, state)].filter(Boolean))];
}

export function unresolvedSubmission(state, post, key = null) {
  const keys = new Set([key, ...publicationKeys(post, state)].filter(Boolean));
  return (state.submissionUncertainties || []).find((item) => item.status === "UNKNOWN" && (
    item.jobId === post.id || item.idempotencyKeys?.some((candidate) => keys.has(candidate))
  ));
}

export function recordSubmissionUnknown(state, post, attempt, { executionId = null, reasonCode, evidenceReferences = [], detectedAt }) {
  state.submissionUncertainties ||= [];
  const existing = state.submissionUncertainties.find((item) => item.status === "UNKNOWN" && (item.jobId === post.id || item.publicationAttemptId === attempt.id));
  if (existing) return existing;
  const target = state.targets.find((item) => item.id === post.targetId);
  if (!target) throw new Error("Unknown submission requires its original target");
  const keys = publicationKeys(post, state);
  if (!keys.length) throw new Error("Unknown submission requires a stable publication identity");
  const artifact = (state.artifacts || []).find((item) => item.id === post.artifactId);
  const row = {
    id: randomUUID(), status: "UNKNOWN", jobId: post.id, campaignId: post.campaignId,
    platform: target.channel, accountId: target.accountId, targetId: target.id,
    publicationAttemptId: attempt.id, executionId,
    idempotencyKeys: keys,
    contentSha256: createHash("sha256").update(String(post.content || "")).digest("hex"),
    mediaArtifactId: artifact?.id || post.artifactId || null,
    mediaSha256: artifact?.sha256 || null,
    detectedAt, reasonCode, evidenceReferences, lastReconciliationAt: null
  };
  state.submissionUncertainties.push(row);
  post.submissionUncertaintyId = row.id;
  post.status = UNKNOWN_POST_STATUS;
  post.executionState = "SUBMIT_RESULT_UNKNOWN";
  post.updatedAt = detectedAt;
  attempt.status = "unknown";
  return row;
}

export function activeExecutionForPost(state, postId, at = Date.now()) {
  const leased = (state.executionLeases || []).some((item) => item.jobId === postId && Date.parse(item.expiresAt) > at);
  const executing = (state.executionRequests || []).some((item) => item.jobId === postId && item.state === "EXECUTING");
  return leased || executing;
}
