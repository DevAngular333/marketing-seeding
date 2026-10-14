import { randomUUID } from "node:crypto";
import path from "node:path";
import { campaignContentHash, campaignAuthorizationFingerprint } from "./campaign-authorization.mjs";
import { contentSha256 } from "./execution-contracts.mjs";

export const LIVE_EXECUTION_GRANT_SCHEMA_VERSION = 1;
export const LIVE_GRANT_STATUSES = Object.freeze(["ACTIVE", "CONSUMED", "EXPIRED", "REVOKED"]);
const SHA256 = /^[a-f0-9]{64}$/i;

function required(value, name) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`LiveExecutionGrantV1 ${name} is required`);
  return result;
}

export function createLiveExecutionGrantV1({ post, target, account, authorization, artifact, validFrom, validUntil, createdBy, operatorAuthorizationReference, now = new Date() }) {
  const from = Date.parse(validFrom);
  const until = Date.parse(validUntil);
  if (!Number.isFinite(from) || !Number.isFinite(until) || until <= from || until <= now.getTime() || until - from > 24 * 60 * 60_000) {
    throw new Error("Live grant requires a future validity window of at most 24 hours");
  }
  if (!post || !target || !account || !authorization || !createdBy) throw new Error("Live grant requires a bound job, account and campaign authorization");
  if (authorization.status !== "active" || authorization.id !== post.campaignAuthorizationId || authorization.campaignId !== post.campaignId ||
      authorization.binding !== post.campaignAuthorizationBinding || authorization.binding !== campaignAuthorizationFingerprint(authorization) ||
      Date.parse(authorization.validFrom) > from || Date.parse(authorization.validUntil) < until) {
    throw new Error("Live grant requires an active, unchanged campaign authorization covering its validity window");
  }
  if (account.status !== "enabled" || account.accountId !== target.accountId || account.platform !== target.channel || account.profileId !== target.profileId) {
    throw new Error("Live grant account/profile does not match the target");
  }
  if (!authorization.destinations?.some((item) => item.platform === target.channel && item.accountId === target.accountId && item.profileId === target.profileId && item.targetId === target.id && item.targetUrl === target.url) ||
      !authorization.audienceRules?.allowedAudiences?.includes(post.audience)) {
    throw new Error("Live grant destination or audience is outside campaign authorization");
  }
  const canonicalHash = campaignContentHash(post.content);
  if (authorization.contentBoundary?.mode === "approved_copy_set" && !authorization.contentBoundary.contentHashes.includes(canonicalHash)) {
    throw new Error("Live grant requires exact approved copy");
  }
  if (!["approved_copy_set", "approved_template_set"].includes(authorization.contentBoundary?.mode)) {
    throw new Error("Live grant requires an approved content boundary");
  }
  if ((post.assetPath || post.artifactId || post.assetSha256) && !artifact) throw new Error("Live grant requires a registered media artifact");
  if (artifact && (artifact.id !== post.artifactId || artifact.sha256 !== post.assetSha256 ||
      !post.assetPath || path.resolve(artifact.path) !== path.resolve(post.assetPath) ||
      !authorization.approvedAssets?.some((item) => item.artifactId === artifact.id && item.sha256 === artifact.sha256))) {
    throw new Error("Live grant media is outside campaign authorization");
  }
  const grant = {
    schemaVersion: LIVE_EXECUTION_GRANT_SCHEMA_VERSION,
    grantId: randomUUID(), campaignAuthorizationId: authorization.id, campaignAuthorizationBinding: authorization.binding,
    campaignId: post.campaignId, jobId: post.id, boundExecutionId: null,
    platform: target.channel, accountId: target.accountId, profileId: target.profileId, targetId: target.id,
    content: { contentId: required(post.contentId, "contentId"), canonicalSha256: canonicalHash, rawSha256: contentSha256(post.content) },
    media: artifact ? [{ artifactId: artifact.id, sha256: artifact.sha256 }] : [],
    audience: required(post.audience, "audience"), idempotencyKey: required(post.idempotencyKey, "idempotencyKey"),
    validFrom: new Date(from).toISOString(), validUntil: new Date(until).toISOString(), maxExecutions: 1,
    createdAt: now.toISOString(), createdBy: required(createdBy, "createdBy"),
    operatorAuthorizationReference: required(operatorAuthorizationReference, "operatorAuthorizationReference"), status: "ACTIVE",
    consumedAt: null, revokedAt: null
  };
  return validateLiveExecutionGrantV1(grant);
}

export function validateLiveExecutionGrantV1(grant) {
  if (!grant || grant.schemaVersion !== 1 || !LIVE_GRANT_STATUSES.includes(grant.status) || grant.maxExecutions !== 1) throw new Error("Invalid LiveExecutionGrantV1 status, schema or execution limit");
  for (const key of ["grantId", "campaignAuthorizationId", "campaignAuthorizationBinding", "campaignId", "jobId", "platform", "accountId", "profileId", "targetId", "audience", "idempotencyKey", "createdBy", "operatorAuthorizationReference"]) required(grant[key], key);
  for (const key of ["canonicalSha256", "rawSha256"]) if (!SHA256.test(grant.content?.[key] || "")) throw new Error(`Invalid live grant content ${key}`);
  required(grant.content?.contentId, "content.contentId");
  if (!Array.isArray(grant.media) || grant.media.some((item) => !item.artifactId || !SHA256.test(item.sha256))) throw new Error("Invalid live grant media identity");
  if (!["validFrom", "validUntil", "createdAt"].every((key) => Number.isFinite(Date.parse(grant[key]))) || Date.parse(grant.validUntil) <= Date.parse(grant.validFrom)) throw new Error("Invalid live grant timestamps");
  return grant;
}

export function liveGrantEffectiveStatus(grant, now = new Date()) {
  if (grant.status !== "ACTIVE") return grant.status;
  return now.getTime() > Date.parse(grant.validUntil) ? "EXPIRED" : "ACTIVE";
}

export function assertLiveGrantMatchesExecution(grant, request, authorization, now = new Date(), { checkWindow = true } = {}) {
  validateLiveExecutionGrantV1(grant);
  if (grant.status !== "ACTIVE" || grant.consumedAt || grant.consumedExecutionId ||
      (checkWindow && (now.getTime() < Date.parse(grant.validFrom) || now.getTime() > Date.parse(grant.validUntil)))) {
    throw new Error("Live execution grant is inactive, consumed or expired");
  }
  if (!request || request.dryRun === true || grant.boundExecutionId !== request.executionId || request.liveGrant?.grantId !== grant.grantId ||
      grant.campaignId !== request.campaignId || grant.jobId !== request.jobId || grant.platform !== request.platform ||
      grant.accountId !== request.accountId || grant.profileId !== request.profileId || grant.targetId !== request.target?.targetId ||
      grant.audience !== request.audience || grant.idempotencyKey !== request.idempotencyKey ||
      grant.campaignAuthorizationId !== request.authorization?.authorizationId || grant.campaignAuthorizationBinding !== request.authorization?.binding ||
      grant.content.contentId !== request.content?.contentId || grant.content.rawSha256 !== request.content?.sha256 ||
      grant.media.length !== request.media?.length || grant.media.some((item, index) => item.artifactId !== request.media[index].artifactId || item.sha256 !== request.media[index].sha256) ||
      authorization?.id !== grant.campaignAuthorizationId || authorization.binding !== grant.campaignAuthorizationBinding) {
    throw new Error("Live execution grant does not match the exact execution request");
  }
  return true;
}
