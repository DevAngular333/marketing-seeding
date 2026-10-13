import { createHash } from "node:crypto";

export const EXECUTION_REQUEST_SCHEMA_VERSION = 1;
export const EXECUTION_RECEIPT_SCHEMA_VERSION = 1;
export const SUBMIT_STATES = Object.freeze(["NOT_STARTED", "SUBMIT_SENT", "CONFIRMED", "UNKNOWN", "FAILED"]);
export const EXECUTION_STATES = Object.freeze(["REQUEST_READY", "DRY_RUN_COMPLETE", "DRY_RUN_FAILED", "SUBMIT_SENT_INTENT", "SUBMIT_SENT", "SUBMIT_RESULT_UNKNOWN", "CONFIRMED", "FAILED"]);

const sha256Pattern = /^[a-f0-9]{64}$/i;
const secretKeyPattern = /(password|passwd|cookie|bearer|token|credential|mfa|passkey|sessionstorage|localstorage|secret|authorizationheader)/i;
const errorClasses = new Set(["AUTH_REQUIRED", "ACCOUNT_MISMATCH", "CONTENT_MISMATCH", "MEDIA_MISMATCH", "UPLOAD_ERROR", "UNKNOWN_COMPOSER", "PLATFORM_ERROR", "NETWORK_ERROR", "TIMEOUT", "VALIDATION_ERROR", "NONE"]);
const recoveryClasses = new Set(["RECOVERABLE", "HUMAN_REQUIRED", "UNKNOWN", "NONE"]);

function required(value, label) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function assertNoSecrets(value, path = "contract") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (secretKeyPattern.test(key)) throw new Error(`Execution contract cannot include secret-like field ${path}.${key}`);
    assertNoSecrets(child, `${path}.${key}`);
  }
}

export function contentSha256(content) {
  return createHash("sha256").update(String(content || "")).digest("hex");
}

export function validateExecutionRequestV1(input) {
  if (!input || typeof input !== "object" || input.schemaVersion !== EXECUTION_REQUEST_SCHEMA_VERSION) {
    throw new Error("ExecutionRequestV1 schemaVersion must equal 1");
  }
  assertNoSecrets(input);
  const request = {
    schemaVersion: 1,
    executionId: required(input.executionId, "executionId"),
    jobId: required(input.jobId, "jobId"),
    campaignId: required(input.campaignId, "campaignId"),
    platform: required(input.platform, "platform"),
    accountId: required(input.accountId, "accountId"),
    profileId: required(input.profileId, "profileId"),
    target: {
      targetId: required(input.target?.targetId, "target.targetId"),
      url: required(input.target?.url, "target.url")
    },
    audience: required(input.audience, "audience"),
    testJob: input.testJob === true,
    dryRun: input.dryRun === true,
    content: {
      contentId: required(input.content?.contentId, "content.contentId"),
      sha256: required(input.content?.sha256, "content.sha256").toLowerCase(),
      payload: String(input.content?.payload ?? "")
    },
    media: Array.isArray(input.media) ? input.media.map((item, index) => ({
      artifactId: required(item.artifactId, `media[${index}].artifactId`),
      reference: required(item.reference, `media[${index}].reference`),
      sha256: required(item.sha256, `media[${index}].sha256`).toLowerCase(),
      type: required(item.type, `media[${index}].type`)
    })) : [],
    authorization: {
      authorizationId: required(input.authorization?.authorizationId, "authorization.authorizationId"),
      binding: required(input.authorization?.binding, "authorization.binding")
    },
    idempotencyKey: required(input.idempotencyKey, "idempotencyKey"),
    readiness: {
      state: required(input.readiness?.state, "readiness.state"),
      checkedAt: required(input.readiness?.checkedAt, "readiness.checkedAt"),
      expiresAt: required(input.readiness?.expiresAt, "readiness.expiresAt"),
      binding: required(input.readiness?.binding, "readiness.binding")
    },
    createdAt: required(input.createdAt, "createdAt")
  };
  if (!sha256Pattern.test(request.content.sha256) || request.content.sha256 !== contentSha256(request.content.payload)) {
    throw new Error("ExecutionRequestV1 content hash does not match payload");
  }
  if (request.media.some((item) => !sha256Pattern.test(item.sha256))) throw new Error("ExecutionRequestV1 media entries require SHA-256 digests");
  if (request.readiness.state !== "READY") throw new Error("ExecutionRequestV1 requires READY readiness");
  for (const field of ["checkedAt", "expiresAt", "createdAt"]) {
    if (!Number.isFinite(Date.parse(request[field] || request.readiness[field] || ""))) throw new Error(`ExecutionRequestV1 ${field} must be an ISO timestamp`);
  }
  if (Date.parse(request.readiness.expiresAt) <= Date.parse(request.readiness.checkedAt)) throw new Error("ExecutionRequestV1 readiness expiry must follow checkedAt");
  return request;
}

export function validateExecutionReceiptV1(input) {
  if (!input || typeof input !== "object" || input.schemaVersion !== EXECUTION_RECEIPT_SCHEMA_VERSION) {
    throw new Error("ExecutionReceiptV1 schemaVersion must equal 1");
  }
  assertNoSecrets(input);
  const receipt = {
    schemaVersion: 1,
    executionId: required(input.executionId, "executionId"),
    jobId: required(input.jobId, "jobId"),
    attempt: Number(input.attempt),
    startedAt: required(input.startedAt, "startedAt"),
    finishedAt: required(input.finishedAt, "finishedAt"),
    readinessResult: {
      state: required(input.readinessResult?.state, "readinessResult.state").toUpperCase(),
      checkedAt: required(input.readinessResult?.checkedAt, "readinessResult.checkedAt"),
      reasonCode: String(input.readinessResult?.reasonCode || "ready").slice(0, 80)
    },
    submitState: required(input.submitState, "submitState").toUpperCase(),
    dryRun: input.dryRun === true,
    publicationUrl: input.publicationUrl ? String(input.publicationUrl) : null,
    publicationReference: input.publicationReference ? String(input.publicationReference) : null,
    publicationEvidence: input.publicationEvidence && typeof input.publicationEvidence === "object" ? {
      verifiedAt: required(input.publicationEvidence.verifiedAt, "publicationEvidence.verifiedAt"),
      accountMatched: input.publicationEvidence.accountMatched === true,
      targetMatched: input.publicationEvidence.targetMatched === true,
      contentHashMatched: input.publicationEvidence.contentHashMatched === true,
      mediaHashMatched: input.publicationEvidence.mediaHashMatched === true,
      accountId: required(input.publicationEvidence.accountId, "publicationEvidence.accountId"),
      profileId: required(input.publicationEvidence.profileId, "publicationEvidence.profileId"),
      targetId: required(input.publicationEvidence.targetId, "publicationEvidence.targetId"),
      contentHash: required(input.publicationEvidence.contentHash, "publicationEvidence.contentHash"),
      mediaHash: input.publicationEvidence.mediaHash ? String(input.publicationEvidence.mediaHash).toLowerCase() : null,
      verificationMethod: required(input.publicationEvidence.verificationMethod, "publicationEvidence.verificationMethod"),
      evidenceReference: input.publicationEvidence.evidenceReference ? String(input.publicationEvidence.evidenceReference) : null
    } : null,
    reconciliation: input.reconciliation === true,
    errorClassification: String(input.errorClassification || "NONE").toUpperCase(),
    recoveryClassification: String(input.recoveryClassification || "NONE").toUpperCase(),
    telemetry: {
      durationMs: Number(input.telemetry?.durationMs ?? 0),
      browserCommands: Number(input.telemetry?.browserCommands ?? 0),
      computerUseCalls: Number(input.telemetry?.computerUseCalls ?? 0),
      retries: Number(input.telemetry?.retries ?? 0),
      readinessRefreshMs: Number(input.telemetry?.readinessRefreshMs ?? 0),
      queueToWorkerMs: Number(input.telemetry?.queueToWorkerMs ?? 0),
      leaseAcquireMs: Number(input.telemetry?.leaseAcquireMs ?? 0),
      profileAcquireMs: Number(input.telemetry?.profileAcquireMs ?? 0),
      navigationMs: Number(input.telemetry?.navigationMs ?? 0),
      targetVerifyMs: Number(input.telemetry?.targetVerifyMs ?? 0),
      composerOpenMs: Number(input.telemetry?.composerOpenMs ?? 0),
      contentFillMs: Number(input.telemetry?.contentFillMs ?? 0),
      mediaAttachMs: Number(input.telemetry?.mediaAttachMs ?? 0),
      mediaReadyMs: Number(input.telemetry?.mediaReadyMs ?? 0),
      preSubmitVerifyMs: Number(input.telemetry?.preSubmitVerifyMs ?? 0),
      cleanupMs: Number(input.telemetry?.cleanupMs ?? 0),
      totalDryRunMs: Number(input.telemetry?.totalDryRunMs ?? 0)
    },
    verificationGates: input.verificationGates && typeof input.verificationGates === "object"
      ? Object.fromEntries(Object.entries(input.verificationGates).filter(([, value]) => typeof value === "boolean"))
      : null
  };
  if (!Number.isSafeInteger(receipt.attempt) || receipt.attempt < 1) throw new Error("ExecutionReceiptV1 attempt must be a positive integer");
  for (const field of ["startedAt", "finishedAt"]) if (!Number.isFinite(Date.parse(receipt[field]))) throw new Error(`ExecutionReceiptV1 ${field} must be an ISO timestamp`);
  if (Date.parse(receipt.finishedAt) < Date.parse(receipt.startedAt)) throw new Error("ExecutionReceiptV1 finishedAt cannot precede startedAt");
  if (!new Set(["READY", "BLOCKED", "HUMAN_REQUIRED", "UNKNOWN"]).has(receipt.readinessResult.state)) throw new Error("ExecutionReceiptV1 readinessResult state is invalid");
  if (!SUBMIT_STATES.includes(receipt.submitState)) throw new Error("ExecutionReceiptV1 submitState is invalid");
  if (receipt.dryRun && receipt.submitState !== "NOT_STARTED") throw new Error("A dry-run receipt must remain NOT_STARTED");
  if (!errorClasses.has(receipt.errorClassification)) throw new Error("ExecutionReceiptV1 errorClassification is invalid");
  if (!recoveryClasses.has(receipt.recoveryClassification)) throw new Error("ExecutionReceiptV1 recoveryClassification is invalid");
  for (const [name, value] of Object.entries(receipt.telemetry)) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`ExecutionReceiptV1 telemetry.${name} must be a nonnegative integer`);
  }
  if (receipt.submitState === "CONFIRMED" && !receipt.publicationUrl && !receipt.publicationReference) {
    throw new Error("CONFIRMED receipt requires a publication URL or reference");
  }
  if (receipt.submitState === "CONFIRMED" && (!receipt.publicationEvidence || receipt.publicationEvidence.accountMatched !== true || receipt.publicationEvidence.targetMatched !== true || receipt.publicationEvidence.contentHashMatched !== true || receipt.publicationEvidence.mediaHashMatched !== true)) {
    throw new Error("CONFIRMED receipt requires positive account, target, content, and media evidence");
  }
  if (receipt.dryRun && (receipt.publicationUrl || receipt.publicationReference || receipt.publicationEvidence)) {
    throw new Error("Dry-run receipt cannot contain publication evidence");
  }
  if (receipt.submitState === "CONFIRMED" && (!receipt.publicationEvidence || receipt.publicationEvidence.accountMatched !== true || receipt.publicationEvidence.targetMatched !== true || receipt.publicationEvidence.contentHashMatched !== true || receipt.publicationEvidence.mediaHashMatched !== true)) {
    throw new Error("CONFIRMED receipt requires positive account, target, content, and media evidence");
  }
  if (receipt.dryRun && (receipt.publicationUrl || receipt.publicationReference || receipt.publicationEvidence)) {
    throw new Error("Dry-run receipt cannot contain publication evidence");
  }
  if (receipt.publicationEvidence && !Number.isFinite(Date.parse(receipt.publicationEvidence.verifiedAt))) throw new Error("publicationEvidence.verifiedAt must be an ISO timestamp");
  if (receipt.publicationEvidence && !/^[a-f0-9]{64}$/i.test(receipt.publicationEvidence.contentHash)) throw new Error("publicationEvidence.contentHash must be a SHA-256 digest");
  if (receipt.publicationEvidence?.mediaHash && !/^[a-f0-9]{64}$/i.test(receipt.publicationEvidence.mediaHash)) throw new Error("publicationEvidence.mediaHash must be a SHA-256 digest");
  if (["SUBMIT_SENT", "UNKNOWN"].includes(receipt.submitState) && receipt.recoveryClassification === "RECOVERABLE") {
    throw new Error("A possibly submitted execution cannot be classified as safely recoverable");
  }
  return receipt;
}

export function createExecutionRequestV1({ executionId, post, target, account, authorization, readiness, artifact, dryRun = false, createdAt = new Date().toISOString() }) {
  return validateExecutionRequestV1({
    schemaVersion: 1,
    executionId,
    jobId: post.id,
    campaignId: post.campaignId,
    platform: target.channel,
    accountId: account.accountId,
    profileId: account.profileId,
    target: { targetId: target.id, url: target.url },
    audience: post.audience,
    testJob: post.testJob === true,
    dryRun,
    content: { contentId: post.contentId, sha256: contentSha256(post.content), payload: post.content },
    media: artifact ? [{ artifactId: artifact.id, reference: artifact.path, sha256: artifact.sha256, type: artifact.mimeType || artifact.mediaType || "application/octet-stream" }] : [],
    authorization: { authorizationId: authorization.id, binding: authorization.binding },
    idempotencyKey: post.idempotencyKey,
    readiness: { state: "READY", checkedAt: readiness.checkedAt, expiresAt: readiness.expiresAt, binding: readiness.binding },
    createdAt
  });
}
