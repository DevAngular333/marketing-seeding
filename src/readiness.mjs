import { createHash } from "node:crypto";

export const DEFAULT_READINESS_TTL_MS = 5 * 60 * 1000;
export const MAX_READINESS_TTL_MS = 60 * 60 * 1000;
export const MAX_READINESS_ATTEMPTS = 3;
export const READINESS_STATES = Object.freeze(["READY", "BLOCKED", "HUMAN_REQUIRED", "UNKNOWN"]);

const secretKeyPattern = /(password|passwd|cookie|bearer|token|credential|mfa|passkey|sessionstorage|localstorage|secret|authorizationheader)/i;
const accountHealthStates = new Set(["unknown", "healthy", "blocked", "human_required", "error"]);

function required(value, label) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function configuredReadinessTtlMs(value = process.env.SEEDING_READINESS_TTL_MS) {
  if (value === undefined || value === null || value === "") return DEFAULT_READINESS_TTL_MS;
  const ttl = Number(value);
  if (!Number.isSafeInteger(ttl) || ttl < 1_000 || ttl > MAX_READINESS_TTL_MS) {
    throw new Error(`SEEDING_READINESS_TTL_MS must be an integer from 1000 to ${MAX_READINESS_TTL_MS}`);
  }
  return ttl;
}

export function readinessBinding({ platform, accountId, profileId, targetId }) {
  return digest({
    platform: required(platform, "readiness platform"),
    accountId: required(accountId, "readiness accountId"),
    profileId: required(profileId, "readiness profileId"),
    targetId: required(targetId, "readiness targetId")
  });
}

export function normalizeExecutionAccount(input, now = new Date()) {
  const platform = required(input.platform, "account platform");
  const accountId = required(input.accountId, "account accountId");
  const profileId = required(input.profileId, "account profileId");
  const status = String(input.status || "enabled");
  if (!new Set(["enabled", "disabled"]).has(status)) throw new Error("Account status must be enabled or disabled");
  const health = String(input.health || "unknown");
  if (!accountHealthStates.has(health)) throw new Error("Unsupported account health state");

  let expectedIdentityUrl = null;
  if (input.expectedIdentityUrl) {
    let url;
    try { url = new URL(String(input.expectedIdentityUrl)); } catch { throw new Error("expectedIdentityUrl must be a valid HTTPS URL"); }
    if (url.protocol !== "https:" || !/(^|\.)linkedin\.com$/i.test(url.hostname) || !/^\/(?:in|company)\/[^/]+\/?$/i.test(url.pathname)) {
      throw new Error("LinkedIn expectedIdentityUrl must identify an /in/ or /company/ profile URL");
    }
    url.search = "";
    url.hash = "";
    expectedIdentityUrl = url.toString();
  }
  if (platform === "linkedin" && !expectedIdentityUrl) throw new Error("LinkedIn accounts require expectedIdentityUrl for identity verification");

  return {
    id: `${platform}:${accountId}`,
    platform,
    accountId,
    profileId,
    expectedIdentityUrl,
    status,
    health,
    lastReadinessAt: input.lastReadinessAt && Number.isFinite(Date.parse(input.lastReadinessAt)) ? new Date(input.lastReadinessAt).toISOString() : null,
    createdAt: input.createdAt || now.toISOString(),
    updatedAt: now.toISOString()
  };
}

function assertNoSecrets(value, path = "result") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (secretKeyPattern.test(key)) throw new Error(`Readiness data must not include secret-like field: ${path}.${key}`);
    assertNoSecrets(child, `${path}.${key}`);
  }
}

export function normalizeReadinessResult(input, context, { now = new Date(), ttlMs = DEFAULT_READINESS_TTL_MS } = {}) {
  if (!input || typeof input !== "object") throw new Error("Readiness provider must return an object");
  assertNoSecrets(input);
  const state = String(input.state || "UNKNOWN").toUpperCase();
  if (!READINESS_STATES.includes(state)) throw new Error(`Unsupported readiness state: ${state}`);
  const checkedAt = input.checkedAt ? new Date(input.checkedAt) : now;
  if (!Number.isFinite(checkedAt.getTime())) throw new Error("Readiness checkedAt must be a valid timestamp");
  const defaultExpiry = new Date(checkedAt.getTime() + ttlMs);
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : defaultExpiry;
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= checkedAt) throw new Error("Readiness expiresAt must be later than checkedAt");
  if (expiresAt.getTime() - checkedAt.getTime() > ttlMs) throw new Error("Readiness expiry exceeds the configured freshness window");
  const capabilities = input.capabilities && typeof input.capabilities === "object" && !Array.isArray(input.capabilities)
    ? Object.fromEntries(Object.entries(input.capabilities).filter(([, enabled]) => typeof enabled === "boolean"))
    : {};
  const result = {
    state,
    checkedAt: checkedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    reasonCode: String(input.reasonCode || (state === "READY" ? "ready" : state.toLowerCase())).slice(0, 80),
    capabilities,
    evidenceReference: String(input.evidenceReference || "").slice(0, 240) || null,
    retryable: input.retryable === true,
    recoveryClassification: String(input.recoveryClassification || (state === "HUMAN_REQUIRED" ? "HUMAN_REQUIRED" : state === "UNKNOWN" ? "UNKNOWN" : state === "BLOCKED" && input.retryable ? "RECOVERABLE" : "NONE")),
    binding: readinessBinding(context),
    accountId: context.accountId,
    platform: context.platform,
    profileId: context.profileId,
    targetId: context.targetId
  };
  if (!new Set(["RECOVERABLE", "HUMAN_REQUIRED", "UNKNOWN", "NONE"]).has(result.recoveryClassification)) {
    throw new Error("Unsupported readiness recoveryClassification");
  }
  return result;
}

export function isReadinessFresh(readiness, expected, now = new Date(), ttlMs = DEFAULT_READINESS_TTL_MS) {
  if (!readiness || !expected) return false;
  if (!expected.platform || !expected.accountId || !expected.profileId || !expected.targetId) return false;
  if (String(readiness.state).toUpperCase() !== "READY") return false;
  const checkedAt = Date.parse(readiness.checkedAt || "");
  const expiresAt = Date.parse(readiness.expiresAt || "");
  const current = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(checkedAt) || !Number.isFinite(expiresAt) || !Number.isFinite(current)) return false;
  if (checkedAt > current + 30_000 || current - checkedAt > ttlMs || expiresAt <= current || expiresAt - checkedAt > ttlMs) return false;
  return readiness.binding === readinessBinding(expected) &&
    readiness.accountId === expected.accountId && readiness.profileId === expected.profileId &&
    readiness.platform === expected.platform && readiness.targetId === expected.targetId;
}

const HUMAN_ERROR_CODES = new Set(["MFA_REQUIRED", "PASSKEY_REQUIRED", "SECURITY_CHALLENGE", "ACCOUNT_LOCKED", "ACCOUNT_MISMATCH", "IDENTITY_AMBIGUOUS"]);
const RETRYABLE_ERROR_CODES = new Set(["ORCA_RUNTIME_UNAVAILABLE", "NETWORK_ERROR", "PAGE_LOAD_TIMEOUT", "PLATFORM_UNAVAILABLE", "PROVIDER_TIMEOUT"]);

export function classifyReadinessError(error) {
  const code = String(error?.code || "UNKNOWN").toUpperCase();
  if (HUMAN_ERROR_CODES.has(code)) return { state: "HUMAN_REQUIRED", reasonCode: code.toLowerCase(), retryable: false, recoveryClassification: "HUMAN_REQUIRED" };
  if (RETRYABLE_ERROR_CODES.has(code)) return { state: "UNKNOWN", reasonCode: code.toLowerCase(), retryable: true, recoveryClassification: "RECOVERABLE" };
  return { state: "UNKNOWN", reasonCode: "provider_error", retryable: false, recoveryClassification: "UNKNOWN" };
}

export function executionAccountKey(platform, accountId) {
  return `${required(platform, "account platform")}:${required(accountId, "accountId")}`;
}
